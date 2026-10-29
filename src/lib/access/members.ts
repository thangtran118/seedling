import "server-only";
import { randomInt } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, listenerLinks, sessionMembers, users } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { pickedOrOwnArea } from "./areas";
import { revokeAllSessions, type SessionUser } from "./auth";
import { invalidError, notFoundError } from "./errors";
import { requireCanManageMember, requireLeader, requireLeadsArea } from "./scope";

export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export type RegionMember = {
  id: number;
  name: string;
  role: SessionUser["role"];
  area: { id: number; name: string } | null; // null: the region leader, who belongs to no area
};

export type MemberAdminView = Omit<RegionMember, "area"> & {
  phone: string;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
};

// A person's name in a picker, with their area when it is not the viewer's.
export const memberLabel = (viewer: SessionUser, m: RegionMember) =>
  !m.area ? `${m.name} · Địa vực trưởng` : m.area.id === viewer.areaId ? m.name : `${m.name} · ${m.area.name}`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Active people of the whole region, the viewer's own area first, for the "người đi cùng" and "thêm người đồng hành"
// pickers: trudo across areas of the region is allowed.
export async function listRegionMembers(viewer: SessionUser): Promise<RegionMember[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, areaId: areas.id, areaName: areas.name })
    .from(users)
    .leftJoin(areas, eq(areas.id, users.areaId))
    .where(and(eq(users.regionId, viewer.regionId), eq(users.active, true)))
    .orderBy(asc(areas.name), asc(users.name));
  const people = rows.map(({ areaId, areaName, ...u }) => ({
    ...u,
    area: areaId === null || areaName === null ? null : { id: areaId, name: areaName },
  }));
  const own = (p: RegionMember) => p.area !== null && p.area.id === viewer.areaId;
  return [...people.filter(own), ...people.filter((p) => !own(p))];
}

// Readable temporary password: 4 letters + 4 digits, no ambiguous characters.
export function generateTempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return pick(letters, 4) + pick("23456789", 4);
}

// A member account the viewer may manage: a leader of that person's area; an area leader's account only by the
// region leader (scope.canManageMember).
async function loadMember(viewer: SessionUser, userId: number) {
  requireLeader(viewer);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFoundError("Không tìm thấy thành viên.");
  requireCanManageMember(viewer, user);
  return user;
}

// The accounts of one area (the viewer's own by default; the region leader always picks one), for its leaders.
export async function listMembersForAdmin(viewer: SessionUser, areaId?: number): Promise<MemberAdminView[]> {
  requireLeader(viewer);
  const area = await pickedOrOwnArea(viewer, areaId);
  requireLeadsArea(viewer, { areaId: area.id, regionId: area.regionId });
  const rows = await db.select().from(users).where(eq(users.areaId, area.id)).orderBy(asc(users.name));
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    phone: u.phone,
    active: u.active,
    locked: u.lockedAt !== null,
    mustChangePassword: u.mustChangePassword,
  }));
}

// Inserts a member account of `area` with a temporary password (regions.ts reuses it for a new area leader).
// Returns the temporary password exactly once; it is never stored in plain text.
export async function insertMember(
  tx: Tx,
  viewer: SessionUser,
  area: { id: number; regionId: number },
  input: { name: string; phone: string },
) {
  const name = input.name.trim();
  if (!name || name.length > 100) throw invalidError("Tên không hợp lệ.");
  const phone = normalizePhone(input.phone);
  if (!phone) throw invalidError("Số điện thoại không hợp lệ.");
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (existing) throw invalidError("Số điện thoại này đã có tài khoản.");

  const tempPassword = generateTempPassword();
  const [row] = await tx
    .insert(users)
    .values({
      name,
      phone,
      areaId: area.id,
      regionId: area.regionId,
      role: "member",
      passwordHash: await hash(tempPassword),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
      createdBy: viewer.id,
    })
    .returning({ id: users.id });
  return { id: row.id, phone, tempPassword };
}

// A leader adds a member to an area they lead (an area leader: their own; the region leader: any area of the region).
export async function createMember(viewer: SessionUser, input: { name: string; phone: string; areaId?: number }) {
  requireLeader(viewer);
  const area = await pickedOrOwnArea(viewer, input.areaId);
  requireLeadsArea(viewer, { areaId: area.id, regionId: area.regionId });
  const { phone, tempPassword } = await db.transaction((tx) => insertMember(tx, viewer, area, input));
  return { phone, tempPassword };
}

export async function resetMemberPassword(viewer: SessionUser, userId: number) {
  const user = await loadMember(viewer, userId);
  const tempPassword = generateTempPassword();
  await db
    .update(users)
    .set({
      passwordHash: await hash(tempPassword),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
      failedLogins: 0,
      lockedAt: null,
    })
    .where(eq(users.id, userId));
  await revokeAllSessions(userId);
  return { phone: user.phone, tempPassword };
}

export async function setMemberLocked(viewer: SessionUser, userId: number, locked: boolean) {
  await loadMember(viewer, userId);
  if (userId === viewer.id && locked) throw invalidError("Không thể tự khóa tài khoản của mình.");
  await db
    .update(users)
    .set({ lockedAt: locked ? new Date() : null, failedLogins: 0 })
    .where(eq(users.id, userId));
  if (locked) await revokeAllSessions(userId);
}

// Accounts with no history (e.g. never logged in) are deleted outright; accounts that
// appear in sessions or links are deactivated so the session history stays intact.
export async function removeMember(viewer: SessionUser, userId: number): Promise<"deleted" | "deactivated"> {
  const user = await loadMember(viewer, userId);
  if (userId === viewer.id) throw invalidError("Không thể tự xóa tài khoản của mình.");
  const [{ refs }] = await db
    .select({
      refs: sql<number>`(select count(*) from ${sessionMembers} where ${sessionMembers.userId} = ${userId})
        + (select count(*) from ${listenerLinks} where ${or(eq(listenerLinks.userId, userId), eq(listenerLinks.addedBy, userId))})
        + (select count(*) from sessions where created_by = ${userId})
        + (select count(*) from listeners where created_by = ${userId})`.mapWith(Number),
    })
    .from(users)
    .where(eq(users.id, user.id));
  await revokeAllSessions(userId);
  if (refs === 0) {
    await db.execute(sql`delete from login_attempts where phone = ${user.phone}`);
    await db.execute(sql`delete from auth_sessions where user_id = ${userId}`);
    await db.execute(sql`delete from pii_access_log where viewer_id = ${userId} or target_user_id = ${userId}`);
    await db.delete(users).where(eq(users.id, userId));
    return "deleted";
  }
  await db.update(users).set({ active: false }).where(eq(users.id, userId));
  return "deactivated";
}
