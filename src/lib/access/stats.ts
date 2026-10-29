import "server-only";
import { and, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, listenerPrivate, listeners, sessionMembers, sessions, users } from "@/db/schema";
import { addDays, dayKey, dayStart, sundayWeekStart, WEEKLY_SESSION_GOAL } from "@/lib/domain";
import { pickedOrOwnArea } from "./areas";
import type { SessionUser } from "./auth";
import { forbiddenError, notFoundError } from "./errors";
import { listListenersLinkedTo, type ListenerSummary } from "./listeners";
import { completedAt } from "./phase";
import { inRegion, isRegionLeader, requireLeadsArea } from "./scope";

// Every number here is a count: no private field is read, so nothing needs a pii_access_log row. A "buổi trudo" is
// a completed session the person was in; weeks run Sunday to Saturday. A "chiên mới" is a listener added this
// month with at least one way to reach them (phone, Facebook, Zalo or Telegram).

// Listener numbers at the end of one month (Vietnam calendar). The current month counts up to now.
// The stats page numbers, for one person or the whole area.
export type Overview = {
  sessionsThisWeek: number;
  newThisMonth: number; // added this month, with contact info
  sharedTruth: number; // listeners who have ever reached lesson 1 (on any route)
  baptized: number;
  total: number;
};

export type PersonalStats = Overview & {
  streakWeeks: number; // consecutive weeks, up to this one, with at least WEEKLY_SESSION_GOAL sessions
};

export type MemberStats = PersonalStats & {
  member: { id: number; name: string; role: SessionUser["role"] };
  listeners: ListenerSummary[];
};

// One row of the area's member table, for this month.
export type MemberMonthRow = {
  id: number;
  name: string;
  role: SessionUser["role"];
  sessions: number;
  newListeners: number;
  baptized: number;
};

export type AreaStats = {
  overview: Overview;
};

// Whose numbers: one area (sessions created there, listeners of that area) or the whole region.
type Scope = { areaId: number } | { regionId: number };
const listenerScope = (sc: Scope) =>
  "areaId" in sc ? eq(listeners.areaId, sc.areaId) : eq(listeners.regionId, sc.regionId);
const sessionScope = (sc: Scope) =>
  "areaId" in sc ? eq(sessions.areaId, sc.areaId) : eq(sessions.regionId, sc.regionId);

type Milestones = { createdAt: Date; firstLessonAt: Date | null; baptizedAt: Date | null };
type ListenerRow = Milestones & { manualStatus: string; hasContact: boolean };

const monthKey = (d: Date) => dayKey(d).slice(0, 7);
const monthFrom = (now: Date) => dayStart(`${monthKey(now)}-01`);

function listenerNumbers(rows: ListenerRow[], now: Date) {
  const from = monthFrom(now).getTime();
  return {
    newThisMonth: rows.filter((r) => r.hasContact && r.createdAt.getTime() >= from).length,
    // first_lesson_at, not the current lesson: a listener who moved to another route (back to 0) still heard it.
    sharedTruth: rows.filter((r) => r.firstLessonAt !== null).length,
    baptized: rows.filter((r) => r.manualStatus === "baptem").length,
    total: rows.length,
  };
}

// This week counts toward the streak once it reaches the goal; until then the streak is the run of full weeks just
// before it, so it does not drop to 0 every Sunday.
function weekNumbers(sessionDates: Date[], now: Date) {
  const perWeek = new Map<string, number>();
  for (const d of sessionDates) {
    const w = sundayWeekStart(dayKey(d));
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const thisWeek = sundayWeekStart(dayKey(now));
  const reached = (w: string) => (perWeek.get(w) ?? 0) >= WEEKLY_SESSION_GOAL;
  let streakWeeks = reached(thisWeek) ? 1 : 0;
  for (let w = addDays(thisWeek, -7); reached(w); w = addDays(w, -7)) streakWeeks += 1;
  return { sessionsThisWeek: perWeek.get(thisWeek) ?? 0, streakWeeks };
}

const milestoneCols = {
  createdAt: listeners.createdAt,
  firstLessonAt: listeners.firstLessonAt,
  baptizedAt: listeners.baptizedAt,
};

const listenerCols = {
  ...milestoneCols,
  manualStatus: listeners.manualStatus,
  // Only whether a contact exists, never its value.
  hasContact: sql<boolean>`coalesce(${or(
    isNotNull(listenerPrivate.phone),
    isNotNull(listenerPrivate.facebook),
    isNotNull(listenerPrivate.zalo),
    isNotNull(listenerPrivate.telegram),
  )}, false)`,
};

// The listeners one person walks with (người đồng hành), in any area of the region, as counted in their own stats.
function linkedListeners(userIds: number[], regionId: number) {
  return db
    .select({ userId: listenerLinks.userId, ...listenerCols })
    .from(listenerLinks)
    .innerJoin(listeners, eq(listeners.id, listenerLinks.listenerId))
    .leftJoin(listenerPrivate, eq(listenerPrivate.listenerId, listeners.id))
    .where(and(inArray(listenerLinks.userId, userIds), eq(listeners.regionId, regionId)));
}

// A person's own numbers count every session they went on in the region, whichever area it belongs to.
async function personalStats(userId: number, regionId: number, now: Date): Promise<PersonalStats> {
  const [rows, dates] = await Promise.all([
    linkedListeners([userId], regionId),
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(eq(sessionMembers.userId, userId), eq(sessions.regionId, regionId), completedAt(now))),
  ]);
  return {
    ...weekNumbers(
      dates.map((d) => d.startsAt),
      now,
    ),
    ...listenerNumbers(rows, now),
  };
}

// Everyone's own numbers (the stats page).
export function myStats(viewer: SessionUser, now = new Date()): Promise<PersonalStats> {
  return personalStats(viewer.id, viewer.regionId, now);
}

// A leader of the member's area (its area leader, the region leader): one member, with the listeners they walk with.
export async function memberStats(viewer: SessionUser, memberId: number, now = new Date()): Promise<MemberStats> {
  const [member] = await db
    .select({ id: users.id, name: users.name, role: users.role, areaId: users.areaId, regionId: users.regionId })
    .from(users)
    .where(eq(users.id, memberId));
  if (!member || !inRegion(viewer, member)) throw notFoundError("Không tìm thấy thành viên.");
  requireLeadsArea(viewer, member);
  const [stats, linked] = await Promise.all([
    personalStats(member.id, viewer.regionId, now),
    listListenersLinkedTo(viewer, member.id),
  ]);
  return { ...stats, member: { id: member.id, name: member.name, role: member.role }, listeners: linked };
}

// Everyone in one area, this month: sessions gone on (anywhere in the region), new listeners, listeners baptized.
// Every member sees their own area's table; the region leader picks any area. Sorted by báptem, then sessions, then
// new listeners.
export async function memberMonthTable(
  viewer: SessionUser,
  now = new Date(),
  pick?: number,
): Promise<MemberMonthRow[]> {
  const areaId = await requireAreaVisible(viewer, pick);
  const from = monthFrom(now);
  const memberRows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.areaId, areaId), eq(users.active, true)));
  if (!memberRows.length) return [];
  const ids = memberRows.map((m) => m.id);
  const [sessionRows, links] = await Promise.all([
    db
      .select({ userId: sessionMembers.userId })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(
        and(
          inArray(sessionMembers.userId, ids),
          eq(sessions.regionId, viewer.regionId),
          completedAt(now),
          gte(sessions.startsAt, from),
        ),
      ),
    linkedListeners(ids, viewer.regionId),
  ]);
  return memberRows
    .map((m) => {
      const mine = links.filter((l) => l.userId === m.id);
      return {
        ...m,
        sessions: sessionRows.filter((s) => s.userId === m.id).length,
        newListeners: mine.filter((l) => l.hasContact && l.createdAt >= from).length,
        baptized: mine.filter((l) => l.baptizedAt !== null && l.baptizedAt >= from).length,
      };
    })
    .sort(
      (a, b) =>
        b.baptized - a.baptized ||
        b.sessions - a.sessions ||
        b.newListeners - a.newListeners ||
        a.name.localeCompare(b.name, "vi"),
    );
}

// Members see their own area's numbers; the region leader any area of the region (and must pick one). Returns the
// area id.
async function requireAreaVisible(viewer: SessionUser, pick: number | undefined) {
  const area = await pickedOrOwnArea(viewer, pick);
  if (area.id !== viewer.areaId && !isRegionLeader(viewer))
    throw forbiddenError("Chỉ địa vực trưởng xem được thống kê của khu vực khác.");
  return area.id;
}

async function overviewOf(sc: Scope, now: Date): Promise<AreaStats> {
  const [rows, dates] = await Promise.all([
    db
      .select(listenerCols)
      .from(listeners)
      .leftJoin(listenerPrivate, eq(listenerPrivate.listenerId, listeners.id))
      .where(listenerScope(sc)),
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(and(sessionScope(sc), completedAt(now))),
  ]);
  return {
    overview: {
      sessionsThisWeek: weekNumbers(
        dates.map((d) => d.startsAt),
        now,
      ).sessionsThisWeek,
      ...listenerNumbers(rows, now),
    },
  };
}

// One area: this week's sessions (counted in the area of whoever created them, so no session counts twice in the
// region) and its listeners.
export async function areaStats(viewer: SessionUser, now = new Date(), pick?: number): Promise<AreaStats> {
  const areaId = await requireAreaVisible(viewer, pick);
  return overviewOf({ areaId }, now);
}

// The whole region, for everyone.
export function regionStats(viewer: SessionUser, now = new Date()): Promise<AreaStats> {
  return overviewOf({ regionId: viewer.regionId }, now);
}
