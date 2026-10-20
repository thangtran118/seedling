import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { listeners } from "@/db/schema";
import { daysBetween, STALLED_AFTER_DAYS } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { forbiddenError } from "./errors";
import { listListeners, type ListenerSummary } from "./listeners";

export type StalledItem = ListenerSummary & { daysSince: number | null; flagged: boolean; createdAt: Date };

// Design doc, screen 6: only done sessions count; never-visited first (oldest created), then longest gap.
export async function stalledListeners(
  viewer: SessionUser,
  opts: { includeClosed?: boolean } = {},
): Promise<StalledItem[]> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được danh sách này.");
  const all = await listListeners(viewer);
  const open = opts.includeClosed ? all : all.filter((l) => l.status !== "baptem" && l.status !== "tu_choi");
  const createdRows = open.length
    ? await db
        .select({ id: listeners.id, createdAt: listeners.createdAt })
        .from(listeners)
        .where(
          inArray(
            listeners.id,
            open.map((l) => l.id),
          ),
        )
    : [];
  const createdAt = new Map(createdRows.map((r) => [r.id, r.createdAt]));
  const now = new Date();

  return open
    .map((l) => {
      const daysSince = l.lastDoneAt ? daysBetween(l.lastDoneAt, now) : null;
      return {
        ...l,
        createdAt: createdAt.get(l.id)!,
        daysSince,
        flagged: daysSince === null || daysSince > STALLED_AFTER_DAYS,
      };
    })
    .sort((a, b) => {
      if (a.daysSince === null && b.daysSince === null) return a.createdAt.getTime() - b.createdAt.getTime();
      if (a.daysSince === null) return -1;
      if (b.daysSince === null) return 1;
      return b.daysSince - a.daysSince;
    });
}
