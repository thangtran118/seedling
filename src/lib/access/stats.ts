import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, listeners, users } from "@/db/schema";
import { addMonths, dayKey, dayStart } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { forbiddenError, notFoundError } from "./errors";
import { listListenersLinkedTo, type ListenerSummary } from "./listeners";

// Listener numbers at the end of one month (Vietnam calendar). The current month counts up to now.
export type MonthStats = {
  month: string; // "YYYY-MM"
  total: number; // listeners added by the end of the month
  added: number; // listeners added during the month
  heard: number; // of `total`, those who had reached mảnh 1 by the end of the month
  baptized: number; // of `total`, those marked báptem by the end of the month
};

export type ListenerStats = {
  current: MonthStats;
  previous: MonthStats;
  history: MonthStats[]; // every month since the first listener, newest first; empty when there is none
};

export type MemberStatsRow = {
  id: string;
  name: string;
  role: SessionUser["role"];
  current: MonthStats;
};

export type AreaStats = { area: ListenerStats; members: MemberStatsRow[] };

export type MemberStats = ListenerStats & {
  member: { id: string; name: string; role: SessionUser["role"] };
  listeners: ListenerSummary[];
};

type Milestones = { createdAt: Date; firstLessonAt: Date | null; baptizedAt: Date | null };

const monthKey = (d: Date) => dayKey(d).slice(0, 7);

function monthStats(rows: Milestones[], month: string): MonthStats {
  const from = dayStart(`${month}-01`).getTime();
  const to = dayStart(`${addMonths(month, 1)}-01`).getTime();
  const by = (d: Date | null) => d !== null && d.getTime() < to;
  const counted = rows.filter((r) => by(r.createdAt));
  return {
    month,
    total: counted.length,
    added: counted.filter((r) => r.createdAt.getTime() >= from).length,
    heard: counted.filter((r) => by(r.firstLessonAt)).length,
    baptized: counted.filter((r) => by(r.baptizedAt)).length,
  };
}

function summarize(rows: Milestones[], now: Date): ListenerStats {
  const thisMonth = monthKey(now);
  const history: MonthStats[] = [];
  if (rows.length) {
    const first = monthKey(new Date(Math.min(...rows.map((r) => r.createdAt.getTime()))));
    for (let m = thisMonth; m >= first; m = addMonths(m, -1)) history.push(monthStats(rows, m));
  }
  return {
    current: history[0] ?? monthStats(rows, thisMonth),
    previous: history[1] ?? monthStats(rows, addMonths(thisMonth, -1)),
    history,
  };
}

const milestoneCols = {
  createdAt: listeners.createdAt,
  firstLessonAt: listeners.firstLessonAt,
  baptizedAt: listeners.baptizedAt,
};

// The listeners one person walks with (người đồng hành), as counted in their own stats.
async function linkedMilestones(userId: string, areaId: string) {
  return db
    .select(milestoneCols)
    .from(listenerLinks)
    .innerJoin(listeners, eq(listeners.id, listenerLinks.listenerId))
    .where(and(eq(listenerLinks.userId, userId), eq(listeners.areaId, areaId)));
}

// Everyone's own numbers (home page and the stats tab). Counts only, no private fields.
export async function myStats(viewer: SessionUser, now = new Date()): Promise<ListenerStats> {
  return summarize(await linkedMilestones(viewer.id, viewer.areaId), now);
}

// Leader: one member of the area, with the listeners they walk with.
export async function memberStats(viewer: SessionUser, memberId: string, now = new Date()): Promise<MemberStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const [member] = await db
    .select({ id: users.id, name: users.name, role: users.role, areaId: users.areaId })
    .from(users)
    .where(eq(users.id, memberId));
  if (!member || member.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy thành viên.");
  const [rows, linked] = await Promise.all([
    linkedMilestones(member.id, viewer.areaId),
    listListenersLinkedTo(viewer, member.id),
  ]);
  return {
    ...summarize(rows, now),
    member: { id: member.id, name: member.name, role: member.role },
    listeners: linked,
  };
}

// Leader dashboard: the whole area, and each active member's own numbers. Counts only, no private fields.
export async function areaStats(viewer: SessionUser, now = new Date()): Promise<AreaStats> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được thống kê.");
  const [areaRows, memberRows] = await Promise.all([
    db.select(milestoneCols).from(listeners).where(eq(listeners.areaId, viewer.areaId)),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.areaId, viewer.areaId), eq(users.active, true))),
  ]);
  const links = memberRows.length
    ? await db
        .select({ userId: listenerLinks.userId, ...milestoneCols })
        .from(listenerLinks)
        .innerJoin(listeners, eq(listeners.id, listenerLinks.listenerId))
        .where(
          and(
            eq(listeners.areaId, viewer.areaId),
            inArray(
              listenerLinks.userId,
              memberRows.map((m) => m.id),
            ),
          ),
        )
    : [];
  const thisMonth = monthKey(now);
  const members = memberRows
    .map((m) => ({
      ...m,
      current: monthStats(
        links.filter((l) => l.userId === m.id),
        thisMonth,
      ),
    }))
    .sort((a, b) => b.current.total - a.current.total || a.name.localeCompare(b.name, "vi"));
  return { area: summarize(areaRows, now), members };
}
