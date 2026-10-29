import "server-only";
import { and, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, listenerPrivate, listeners, sessionMembers, sessions, users } from "@/db/schema";
import { addDays, dayKey, dayStart, sundayWeekStart, WEEKLY_SESSION_GOAL } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { forbiddenError, notFoundError } from "./errors";
import { listListenersLinkedTo, type ListenerSummary } from "./listeners";
import { completedAt } from "./phase";

// Every number here is a count: no private field is read, so nothing needs a pii_access_log row. A "buổi trudo" is
// a completed session the person was in; weeks run Sunday to Saturday. A "chiên mới" is a listener added this
// month with at least one way to reach them (phone, Facebook, Zalo or Telegram).

// Listener numbers at the end of one month (Vietnam calendar). The current month counts up to now.
// The stats page numbers, for one person or the whole area.
export type Overview = {
  sessionsThisWeek: number;
  newThisMonth: number; // added this month, with contact info
  sharedTruth: number; // listeners who have reached mảnh 1
  baptized: number;
  total: number;
};

export type PersonalStats = Overview & {
  streakWeeks: number; // consecutive weeks, up to this one, with at least WEEKLY_SESSION_GOAL sessions
};

export type MemberStats = PersonalStats & {
  member: { id: string; name: string; role: SessionUser["role"] };
  listeners: ListenerSummary[];
};

// One row of the area's member table, for this month.
export type MemberMonthRow = {
  id: string;
  name: string;
  role: SessionUser["role"];
  sessions: number;
  newListeners: number;
  baptized: number;
};

export type AreaStats = {
  overview: Overview;
};

type Milestones = { createdAt: Date; firstLessonAt: Date | null; baptizedAt: Date | null };
type ListenerRow = Milestones & { lessonsReached: number; manualStatus: string; hasContact: boolean };

const monthKey = (d: Date) => dayKey(d).slice(0, 7);
const monthFrom = (now: Date) => dayStart(`${monthKey(now)}-01`);

function listenerNumbers(rows: ListenerRow[], now: Date) {
  const from = monthFrom(now).getTime();
  return {
    newThisMonth: rows.filter((r) => r.hasContact && r.createdAt.getTime() >= from).length,
    sharedTruth: rows.filter((r) => r.lessonsReached > 0).length,
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
  lessonsReached: listeners.lessonsReached,
  manualStatus: listeners.manualStatus,
  // Only whether a contact exists, never its value.
  hasContact: sql<boolean>`coalesce(${or(
    isNotNull(listenerPrivate.phone),
    isNotNull(listenerPrivate.facebook),
    isNotNull(listenerPrivate.zalo),
    isNotNull(listenerPrivate.telegram),
  )}, false)`,
};

// The listeners one person walks with (người đồng hành), as counted in their own stats.
function linkedListeners(userIds: string[], areaId: string) {
  return db
    .select({ userId: listenerLinks.userId, ...listenerCols })
    .from(listenerLinks)
    .innerJoin(listeners, eq(listeners.id, listenerLinks.listenerId))
    .leftJoin(listenerPrivate, eq(listenerPrivate.listenerId, listeners.id))
    .where(and(inArray(listenerLinks.userId, userIds), eq(listeners.areaId, areaId)));
}

async function personalStats(userId: string, areaId: string, now: Date): Promise<PersonalStats> {
  const [rows, dates] = await Promise.all([
    linkedListeners([userId], areaId),
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(eq(sessionMembers.userId, userId), eq(sessions.areaId, areaId), completedAt(now))),
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
  return personalStats(viewer.id, viewer.areaId, now);
}

// Leader: one member of the area, with the listeners they walk with.
export async function memberStats(viewer: SessionUser, memberId: string, now = new Date()): Promise<MemberStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const [member] = await db
    .select({ id: users.id, name: users.name, role: users.role, areaId: users.areaId })
    .from(users)
    .where(eq(users.id, memberId));
  if (!member || member.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy thành viên.");
  const [stats, linked] = await Promise.all([
    personalStats(member.id, viewer.areaId, now),
    listListenersLinkedTo(viewer, member.id),
  ]);
  return { ...stats, member: { id: member.id, name: member.name, role: member.role }, listeners: linked };
}

// Everyone in the area, this month: sessions gone on, new listeners, listeners baptized. Visible to every member;
// sorted by báptem, then sessions, then new listeners.
export async function memberMonthTable(viewer: SessionUser, now = new Date()): Promise<MemberMonthRow[]> {
  const from = monthFrom(now);
  const memberRows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.areaId, viewer.areaId), eq(users.active, true)));
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
          eq(sessions.areaId, viewer.areaId),
          completedAt(now),
          gte(sessions.startsAt, from),
        ),
      ),
    linkedListeners(ids, viewer.areaId),
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

// Leader: the whole area — this week's sessions and its listeners.
export async function areaStats(viewer: SessionUser, now = new Date()): Promise<AreaStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const [rows, dates] = await Promise.all([
    db
      .select(listenerCols)
      .from(listeners)
      .leftJoin(listenerPrivate, eq(listenerPrivate.listenerId, listeners.id))
      .where(eq(listeners.areaId, viewer.areaId)),
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(and(eq(sessions.areaId, viewer.areaId), completedAt(now))),
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
