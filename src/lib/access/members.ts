import "server-only";
import { randomInt } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, sessionMembers, users } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { revokeAllSessions, type SessionUser } from "./auth";
import { forbiddenError, invalidError, notFoundError } from "./errors";

export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export type AreaMember = { id: number; name: string; role: "member" | "area_leader" };

export type MemberAdminView = AreaMember & {
  phone: string;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
};

// Active people in the viewer's area, for "người đi cùng" and "thêm người đồng hành" pickers.
export async function listAreaMembers(viewer: SessionUser): Promise<AreaMember[]> {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.areaId, viewer.areaId), eq(users.active, true)))
    .orderBy(asc(users.name));
}

function requireLeader(viewer: SessionUser) {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng mới làm được việc này.");
}

// Readable temporary password: 4 letters + 4 digits, no ambiguous characters.
export function generateTempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return pick(letters, 4) + pick("23456789", 4);
}

async function loadMember(viewer: SessionUser, userId: number) {
  requireLeader(viewer);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy thành viên.");
  return user;
}

export async function listMembersForAdmin(viewer: SessionUser): Promise<MemberAdminView[]> {
  requireLeader(viewer);
  const rows = await db.select().from(users).where(eq(users.areaId, viewer.areaId)).orderBy(asc(users.name));
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

// Returns the temporary password exactly once; it is never stored in plain text.
export async function createMember(viewer: SessionUser, input: { name: string; phone: string }) {
  requireLeader(viewer);
  const name = input.name.trim();
  if (!name || name.length > 100) throw invalidError("Tên không hợp lệ.");
  const phone = normalizePhone(input.phone);
  if (!phone) throw invalidError("Số điện thoại không hợp lệ.");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (existing) throw invalidError("Số điện thoại này đã có tài khoản.");

  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    name,
    phone,
    areaId: viewer.areaId,
    role: "member",
    passwordHash: await hash(tempPassword),
    mustChangePassword: true,
    tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
    createdBy: viewer.id,
  });
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
