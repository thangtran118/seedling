import "server-only";
import { and, count, eq, gte, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, sessionMembers, sessions, users } from "@/db/schema";
import { addDays, dayKey, dayStart, LESSONS, weekStart, type DisplayStatus } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { forbiddenError, notFoundError } from "./errors";
import { listListeners, listListenersLinkedTo, type ListenerSummary } from "./listeners";
import { completedAt } from "./phase";

export const TREND_WEEKS = 8;

export type WeeklyCount = { weekStart: string; done: number };

export type MemberActivity = {
  id: string;
  name: string;
  doneThisWeek: number; // completed sessions joined since Monday
  doneLastWeek: number;
  linkedListeners: number;
  lastDoneAt: Date | null;
};

export type AreaStats = {
  doneThisWeek: number;
  doneLastWeek: number;
  plannedAhead: number;
  weekly: WeeklyCount[]; // oldest first, current week last
  statusCounts: Record<DisplayStatus, number>;
  lessonReach: { lesson: number; listeners: number }[]; // open listeners who heard each lesson
  openListeners: number;
  members: MemberActivity[];
};

// One person's own numbers: sessions they went on and what they have planned.
export type PersonalStats = {
  doneThisWeek: number;
  doneLastWeek: number;
  weekly: WeeklyCount[]; // oldest first, current week last
  plannedAhead: number;
  linkedListeners: number;
};

export type MemberStats = PersonalStats & {
  member: { id: string; name: string; role: SessionUser["role"] };
  listeners: ListenerSummary[];
};

// Week boundaries (Vietnam calendar, Monday first) for the trend window ending with the week of `now`.
function weekWindow(now: Date) {
  const thisWeek = weekStart(dayKey(now));
  return {
    thisWeek,
    thisWeekFrom: dayStart(thisWeek),
    lastWeekFrom: dayStart(addDays(thisWeek, -7)),
    trendFrom: dayStart(addDays(thisWeek, -7 * (TREND_WEEKS - 1))),
  };
}

function bucketWeekly(dates: Date[], thisWeek: string): WeeklyCount[] {
  const weekly = Array.from({ length: TREND_WEEKS }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (TREND_WEEKS - 1 - i)),
    done: 0,
  }));
  const weekIndex = new Map(weekly.map((w, i) => [w.weekStart, i]));
  for (const d of dates) {
    const i = weekIndex.get(weekStart(dayKey(d)));
    if (i !== undefined) weekly[i].done += 1;
  }
  return weekly;
}

async function personalStats(userId: string, areaId: string, now: Date): Promise<PersonalStats> {
  const { thisWeek, trendFrom } = weekWindow(now);
  const mine = and(eq(sessionMembers.userId, userId), eq(sessions.areaId, areaId));

  const [doneRows, [planned], [linked]] = await Promise.all([
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(mine, completedAt(now), gte(sessions.startsAt, trendFrom))),
    db
      .select({ n: count() })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(mine, eq(sessions.state, "planned"), gte(sessions.startsAt, now))),
    db.select({ n: count() }).from(listenerLinks).where(eq(listenerLinks.userId, userId)),
  ]);

  const weekly = bucketWeekly(
    doneRows.map((r) => r.startsAt),
    thisWeek,
  );
  return {
    doneThisWeek: weekly[TREND_WEEKS - 1].done,
    doneLastWeek: weekly[TREND_WEEKS - 2].done,
    weekly,
    plannedAhead: planned.n,
    linkedListeners: linked.n,
  };
}

// Everyone's own numbers (home page and the stats tab).
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
  const [stats, listeners] = await Promise.all([
    personalStats(member.id, viewer.areaId, now),
    listListenersLinkedTo(viewer, member.id),
  ]);
  return { ...stats, member: { id: member.id, name: member.name, role: member.role }, listeners };
}

// Leader dashboard. Counts only, no private fields: nothing here needs a pii_access_log row.
export async function areaStats(viewer: SessionUser, now = new Date()): Promise<AreaStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const { thisWeek, thisWeekFrom, lastWeekFrom, trendFrom } = weekWindow(now);
  const inArea = eq(sessions.areaId, viewer.areaId);

  const [doneRows, [planned], memberRows, activityRows, linkRows, listeners] = await Promise.all([
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(and(inArea, completedAt(now), gte(sessions.startsAt, trendFrom))),
    db
      .select({ n: count() })
      .from(sessions)
      .where(and(inArea, eq(sessions.state, "planned"), gte(sessions.startsAt, now))),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.areaId, viewer.areaId), eq(users.active, true))),
    db
      .select({
        userId: sessionMembers.userId,
        thisWeek:
          sql<number>`count(*) filter (where ${sessions.startsAt} >= ${thisWeekFrom.toISOString()}::timestamptz)`.mapWith(
            Number,
          ),
        lastWeek: sql<number>`count(*) filter (where ${sessions.startsAt} >= ${lastWeekFrom.toISOString()}::timestamptz
          and ${sessions.startsAt} < ${thisWeekFrom.toISOString()}::timestamptz)`.mapWith(Number),
        last: max(sessions.startsAt),
      })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(inArea, completedAt(now)))
      .groupBy(sessionMembers.userId),
    db
      .select({ userId: listenerLinks.userId, n: count() })
      .from(listenerLinks)
      .innerJoin(users, eq(users.id, listenerLinks.userId))
      .where(eq(users.areaId, viewer.areaId))
      .groupBy(listenerLinks.userId),
    listListeners(viewer),
  ]);

  const weekly = bucketWeekly(
    doneRows.map((r) => r.startsAt),
    thisWeek,
  );

  const statusCounts: Record<DisplayStatus, number> = { moi_quen: 0, goi_mo: 0, dang_hoc: 0, baptem: 0, tu_choi: 0 };
  for (const l of listeners) statusCounts[l.status] += 1;
  const open = listeners.filter((l) => l.status !== "baptem" && l.status !== "tu_choi");

  const activity = new Map(activityRows.map((r) => [r.userId, r]));
  const links = new Map(linkRows.map((r) => [r.userId, r.n]));
  const members = memberRows
    .map((m) => ({
      id: m.id,
      name: m.name,
      doneThisWeek: activity.get(m.id)?.thisWeek ?? 0,
      doneLastWeek: activity.get(m.id)?.lastWeek ?? 0,
      linkedListeners: links.get(m.id) ?? 0,
      lastDoneAt: (activity.get(m.id)?.last as Date | null | undefined) ?? null,
    }))
    .sort(
      (a, b) =>
        b.doneThisWeek - a.doneThisWeek || b.doneLastWeek - a.doneLastWeek || a.name.localeCompare(b.name, "vi"),
    );

  return {
    doneThisWeek: weekly[TREND_WEEKS - 1].done,
    doneLastWeek: weekly[TREND_WEEKS - 2].done,
    plannedAhead: planned.n,
    weekly,
    statusCounts,
    lessonReach: LESSONS.map((lesson) => ({
      lesson,
      listeners: open.filter((l) => l.lessons.includes(lesson)).length,
    })),
    openListeners: open.length,
    members,
  };
}
