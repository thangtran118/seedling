import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import type { SessionUser } from "./auth";
import { invalidError } from "./errors";
import { requireAreaInRegion } from "./scope";

export type AreaOption = { id: number; name: string };

// Any area id that comes from the caller (filters, stats, member admin) goes through here: 404 unless it is an area
// of the viewer's region. Open to every member; managing areas is regions.ts.
export async function loadAreaInRegion(viewer: SessionUser, areaId: number) {
  const [row] = await db.select().from(areas).where(eq(areas.id, areaId));
  requireAreaInRegion(viewer, row);
  return row;
}

// An area picked by the caller, or the viewer's own. The region leader belongs to no area, so they must pick one.
export function pickedOrOwnArea(viewer: SessionUser, areaId: number | undefined) {
  const id = areaId ?? viewer.areaId;
  if (id === null) throw invalidError("Chọn khu vực.");
  return loadAreaInRegion(viewer, id);
}

// The region's areas, the viewer's own first, for the area pickers and filters.
export async function listRegionAreas(viewer: SessionUser): Promise<AreaOption[]> {
  const rows = await db
    .select({ id: areas.id, name: areas.name })
    .from(areas)
    .where(eq(areas.regionId, viewer.regionId))
    .orderBy(asc(areas.name));
  return [...rows.filter((a) => a.id === viewer.areaId), ...rows.filter((a) => a.id !== viewer.areaId)];
}
