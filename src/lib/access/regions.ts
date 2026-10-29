import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { areas, listeners, sessions, users } from "@/db/schema";
import { loadAreaInRegion } from "./areas";
import type { SessionUser } from "./auth";
import { invalidError, notFoundError } from "./errors";
import { insertMember } from "./members";
import { inRegion, requireRegionLeader } from "./scope";

// Managing the areas of a region: the region leader (địa vực trưởng) only. Their own account is made by the operator
// CLI (scripts/admin.ts region-leader), never here.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AreaAdminView = {
  id: number;
  name: string;
  leader: { id: number; name: string; role: SessionUser["role"] } | null; // null: no leader yet
  members: number; // active accounts, the leader included
  listeners: number;
  isHome: boolean; // the region leader's own area, which they lead themselves
  deletable: boolean; // never used: no account (even deactivated), listener or session
};

function cleanName(name: string) {
  const t = name.trim();
  if (!t || t.length > 100) throw invalidError("Tên khu vực không hợp lệ.");
  return t;
}

export async function listAreas(viewer: SessionUser): Promise<AreaAdminView[]> {
  requireRegionLeader(viewer);
  const rows = await db.select().from(areas).where(eq(areas.regionId, viewer.regionId)).orderBy(asc(areas.name));
  const ids = rows.map((a) => a.id);
  if (!ids.length) return [];
  const [people, listenerCounts, sessionCounts] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, role: users.role, active: users.active, areaId: users.areaId })
      .from(users)
      .where(inArray(users.areaId, ids)),
    db
      .select({ areaId: listeners.areaId, n: count() })
      .from(listeners)
      .where(inArray(listeners.areaId, ids))
      .groupBy(listeners.areaId),
    db
      .select({ areaId: sessions.areaId, n: count() })
      .from(sessions)
      .where(inArray(sessions.areaId, ids))
      .groupBy(sessions.areaId),
  ]);
  return rows.map((a) => {
    const inArea = people.filter((p) => p.areaId === a.id);
    const leader = inArea.find((p) => p.active && p.role !== "member");
    const nListeners = listenerCounts.find((c) => c.areaId === a.id)?.n ?? 0;
    const nSessions = sessionCounts.find((c) => c.areaId === a.id)?.n ?? 0;
    return {
      id: a.id,
      name: a.name,
      leader: leader ? { id: leader.id, name: leader.name, role: leader.role } : null,
      members: inArea.filter((p) => p.active).length,
      listeners: nListeners,
      isHome: a.id === viewer.areaId,
      deletable: inArea.length === 0 && nListeners === 0 && nSessions === 0,
    };
  });
}

export async function createArea(viewer: SessionUser, name: string): Promise<number> {
  requireRegionLeader(viewer);
  const [row] = await db
    .insert(areas)
    .values({ name: cleanName(name), regionId: viewer.regionId })
    .returning({ id: areas.id });
  return row.id;
}

export async function renameArea(viewer: SessionUser, areaId: number, name: string) {
  requireRegionLeader(viewer);
  await loadAreaInRegion(viewer, areaId);
  await db
    .update(areas)
    .set({ name: cleanName(name) })
    .where(eq(areas.id, areaId));
}

// Only an area created by mistake and never used: sessions are never deleted and accounts with history only
// deactivated, so an area that has had any of them stays.
export async function deleteArea(viewer: SessionUser, areaId: number) {
  requireRegionLeader(viewer);
  await loadAreaInRegion(viewer, areaId);
  if (areaId === viewer.areaId) throw invalidError("Không thể xóa khu vực của địa vực trưởng.");
  await db.transaction(async (tx) => {
    const [[u], [l], [s]] = await Promise.all([
      tx.select({ n: count() }).from(users).where(eq(users.areaId, areaId)),
      tx.select({ n: count() }).from(listeners).where(eq(listeners.areaId, areaId)),
      tx.select({ n: count() }).from(sessions).where(eq(sessions.areaId, areaId)),
    ]);
    if (u.n + l.n + s.n > 0)
      throw invalidError("Chỉ xóa được khu vực chưa từng dùng (không có tài khoản, chiên hay ca nào).");
    await tx.delete(areas).where(eq(areas.id, areaId));
  });
}

async function loadTargetArea(viewer: SessionUser, areaId: number) {
  requireRegionLeader(viewer);
  const area = await loadAreaInRegion(viewer, areaId);
  // The region leader leads their home area themselves (one leader per area).
  if (area.id === viewer.areaId) throw invalidError("Khu vực nhà của địa vực trưởng do địa vực trưởng làm trưởng.");
  return area;
}

// Makes `userId` the leader of `areaId`, in one transaction: the area's current leader (if any) becomes a member,
// and someone from another area of the region moves into this one. Only a plain member qualifies: the leader of
// another area must be replaced there first, so no area loses its leader by accident.
async function promote(tx: Tx, viewer: SessionUser, area: { id: number; name: string }, userId: number) {
  const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!target || !target.active || !inRegion(viewer, target)) throw notFoundError("Không tìm thấy thành viên.");
  if (target.role === "region_leader") throw invalidError("Địa vực trưởng không làm trưởng khu vực khác.");
  if (target.role === "area_leader") {
    if (target.areaId === area.id) return;
    const [other] = await tx.select({ name: areas.name }).from(areas).where(eq(areas.id, target.areaId));
    throw invalidError(
      `Người này đang là trưởng ${other?.name ?? "khu vực khác"}. Gán trưởng mới cho khu vực đó trước.`,
    );
  }
  await tx
    .update(users)
    .set({ role: "member" })
    .where(and(eq(users.areaId, area.id), eq(users.role, "area_leader"), ne(users.id, userId)));
  await tx.update(users).set({ role: "area_leader", areaId: area.id }).where(eq(users.id, userId));
}

export async function assignAreaLeader(viewer: SessionUser, areaId: number, userId: number) {
  const area = await loadTargetArea(viewer, areaId);
  await db.transaction((tx) => promote(tx, viewer, area, userId));
}

// A new account that leads the area straight away. Returns the temporary password exactly once.
export async function createAreaLeader(viewer: SessionUser, areaId: number, input: { name: string; phone: string }) {
  const area = await loadTargetArea(viewer, areaId);
  return db.transaction(async (tx) => {
    const created = await insertMember(tx, viewer, area, input);
    await promote(tx, viewer, area, created.id);
    return { phone: created.phone, tempPassword: created.tempPassword };
  });
}

// Moves a member to another area of the region. Their listeners stay in the old area (a listener belongs where it was
// created); they stay người đồng hành of them, so nothing they could see or edit changes. Leaders do not move: the
// area would be left without one.
export async function moveMember(viewer: SessionUser, userId: number, areaId: number) {
  requireRegionLeader(viewer);
  const area = await loadAreaInRegion(viewer, areaId);
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target || !inRegion(viewer, target)) throw notFoundError("Không tìm thấy thành viên.");
  if (target.role !== "member")
    throw invalidError("Khu vực trưởng không chuyển khu vực được. Gán trưởng mới cho khu vực trước.");
  if (target.areaId === area.id) return;
  await db.update(users).set({ areaId: area.id }).where(eq(users.id, userId));
}
