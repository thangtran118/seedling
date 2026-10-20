import "server-only";
import { and, count, eq, gte, lt, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, sessionLessons, sessionMembers, sessions, users } from "@/db/schema";
import { addDays, dayKey, dayStart, LESSONS, SESSION_LIVE_MS, weekStart, type DisplayStatus } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { forbiddenError } from "./errors";
import { stalledListeners, type StalledItem } from "./stalled";

const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_WEEKS = 8;
export const ACTIVITY_DAYS = 30;

export type MemberActivity = {
  id: string;
  name: string;
  doneRecent: number; // done sessions joined in the last ACTIVITY_DAYS
  linkedListeners: number;
  lastDoneAt: Date | null;
};

export type AreaStats = {
  doneThisWeek: number;
  doneLastWeek: number;
  plannedAhead: number;
  overdue: number; // planned sessions whose live window has passed without a result
  lessonsRecent: number; // lesson shares in done sessions of the last ACTIVITY_DAYS
  weekly: { weekStart: string; done: number }[]; // oldest first, current week last
  statusCounts: Record<DisplayStatus, number>;
  lessonReach: { lesson: number; listeners: number }[]; // open listeners who heard each lesson
  openListeners: number;
  stalled: StalledItem[]; // open listeners past the stalled threshold, worst first
  members: MemberActivity[];
};

// Leader dashboard. Counts only, no private fields: nothing here needs a pii_access_log row.
export async function areaStats(viewer: SessionUser, now = new Date()): Promise<AreaStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const thisWeek = weekStart(dayKey(now));
  const trendFrom = dayStart(addDays(thisWeek, -7 * (TREND_WEEKS - 1)));
  const recentFrom = new Date(now.getTime() - ACTIVITY_DAYS * DAY_MS);
  const inArea = eq(sessions.areaId, viewer.areaId);

  const [doneRows, [planned], [overdue], [lessons], memberRows, activityRows, linkRows, listeners] = await Promise.all([
    db
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(and(inArea, eq(sessions.state, "done"), gte(sessions.startsAt, trendFrom))),
    db
      .select({ n: count() })
      .from(sessions)
      .where(and(inArea, eq(sessions.state, "planned"), gte(sessions.startsAt, now))),
    db
      .select({ n: count() })
      .from(sessions)
      .where(
        and(inArea, eq(sessions.state, "planned"), lt(sessions.startsAt, new Date(now.getTime() - SESSION_LIVE_MS))),
      ),
    db
      .select({ n: count() })
      .from(sessionLessons)
      .innerJoin(sessions, eq(sessions.id, sessionLessons.sessionId))
      .where(and(inArea, eq(sessions.state, "done"), gte(sessions.startsAt, recentFrom))),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.areaId, viewer.areaId), eq(users.active, true))),
    db
      .select({
        userId: sessionMembers.userId,
        recent:
          sql<number>`count(*) filter (where ${sessions.startsAt} >= ${recentFrom.toISOString()}::timestamptz)`.mapWith(
            Number,
          ),
        last: max(sessions.startsAt),
      })
      .from(sessionMembers)
      .innerJoin(sessions, eq(sessions.id, sessionMembers.sessionId))
      .where(and(inArea, eq(sessions.state, "done")))
      .groupBy(sessionMembers.userId),
    db
      .select({ userId: listenerLinks.userId, n: count() })
      .from(listenerLinks)
      .innerJoin(users, eq(users.id, listenerLinks.userId))
      .where(eq(users.areaId, viewer.areaId))
      .groupBy(listenerLinks.userId),
    stalledListeners(viewer, { includeClosed: true }),
  ]);

  const weekly = Array.from({ length: TREND_WEEKS }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (TREND_WEEKS - 1 - i)),
    done: 0,
  }));
  const weekIndex = new Map(weekly.map((w, i) => [w.weekStart, i]));
  for (const r of doneRows) {
    const i = weekIndex.get(weekStart(dayKey(r.startsAt)));
    if (i !== undefined) weekly[i].done += 1;
  }

  const statusCounts: Record<DisplayStatus, number> = { moi_quen: 0, goi_mo: 0, dang_hoc: 0, baptem: 0, tu_choi: 0 };
  for (const l of listeners) statusCounts[l.status] += 1;
  const open = listeners.filter((l) => l.status !== "baptem" && l.status !== "tu_choi");

  const activity = new Map(activityRows.map((r) => [r.userId, r]));
  const links = new Map(linkRows.map((r) => [r.userId, r.n]));
  const members = memberRows
    .map((m) => ({
      id: m.id,
      name: m.name,
      doneRecent: activity.get(m.id)?.recent ?? 0,
      linkedListeners: links.get(m.id) ?? 0,
      lastDoneAt: (activity.get(m.id)?.last as Date | null | undefined) ?? null,
    }))
    .sort((a, b) => b.doneRecent - a.doneRecent || a.name.localeCompare(b.name, "vi"));

  return {
    doneThisWeek: weekly[TREND_WEEKS - 1].done,
    doneLastWeek: weekly[TREND_WEEKS - 2].done,
    plannedAhead: planned.n,
    overdue: overdue.n,
    lessonsRecent: lessons.n,
    weekly,
    statusCounts,
    lessonReach: LESSONS.map((lesson) => ({
      lesson,
      listeners: open.filter((l) => l.lessons.includes(lesson)).length,
    })),
    openListeners: open.length,
    stalled: open.filter((l) => l.flagged),
    members,
  };
}
