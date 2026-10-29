import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, loginAttempts, users } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_PHONE = 5;
export const MAX_FAILS_PER_IP = 30;
export const LOCK_AFTER_CONSECUTIVE_FAILS = 10;

// Verified against when the phone is unknown, so response time does not reveal which phones have accounts.
const DUMMY_HASH_PROMISE = hash("dummy-password-for-timing");

export type SessionUser = {
  id: string;
  name: string;
  role: "member" | "area_leader";
  areaId: string;
  mustChangePassword: boolean;
};

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; user: SessionUser }
  | { ok: false; error: "invalid" | "rate_limited" | "locked" | "temp_expired" };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function toSessionUser(u: typeof users.$inferSelect): SessionUser {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    areaId: u.areaId,
    mustChangePassword: u.mustChangePassword,
  };
}

async function recentFailures(column: typeof loginAttempts.phone | typeof loginAttempts.ip, value: string) {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(column, value), eq(loginAttempts.success, false), gt(loginAttempts.at, since)));
  return row.n;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSessions).values({ id: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function login(rawPhone: string, password: string, ip: string | null): Promise<LoginResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid" };

  if ((await recentFailures(loginAttempts.phone, phone)) >= MAX_FAILS_PER_PHONE)
    return { ok: false, error: "rate_limited" };
  if (ip && (await recentFailures(loginAttempts.ip, ip)) >= MAX_FAILS_PER_IP)
    return { ok: false, error: "rate_limited" };

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user || !user.active) {
    await verify(await DUMMY_HASH_PROMISE, password);
    await db.insert(loginAttempts).values({ phone, ip, success: false });
    return { ok: false, error: "invalid" };
  }

  if (!(await verify(user.passwordHash, password))) {
    const failedLogins = user.failedLogins + 1;
    await db
      .update(users)
      .set({
        failedLogins,
        lockedAt: failedLogins >= LOCK_AFTER_CONSECUTIVE_FAILS && !user.lockedAt ? new Date() : user.lockedAt,
      })
      .where(eq(users.id, user.id));
    await db.insert(loginAttempts).values({ phone, ip, success: false });
    return { ok: false, error: "invalid" };
  }

  // Lock state is only revealed to someone who knows the password.
  if (user.lockedAt) return { ok: false, error: "locked" };
  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
    return { ok: false, error: "temp_expired" };
  }

  await db.update(users).set({ failedLogins: 0 }).where(eq(users.id, user.id));
  await db.insert(loginAttempts).values({ phone, ip, success: true });
  const session = await createSession(user.id);
  return { ok: true, ...session, user: toSessionUser(user) };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(eq(authSessions.id, sha256(token)), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())),
    );
  if (!row || !row.user.active || row.user.lockedAt) return null;
  return toSessionUser(row.user);
}

export async function revokeSession(token: string) {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, sha256(token)));
}

export async function revokeAllSessions(userId: string) {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export type ChangePasswordResult = { ok: true; token: string; expiresAt: Date } | { ok: false; error: string };

// Revokes every session (all devices), then issues a fresh one for the current device.
// `current` is null for the forced first-login change: the session was opened with the temporary password, so it
// is not asked again, but only while that temporary password is still valid.
export async function changePassword(
  userId: string,
  current: string | null,
  next: string,
): Promise<ChangePasswordResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  if (current === null) {
    if (!user.mustChangePassword) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
    if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date())
      return { ok: false, error: "Mật khẩu tạm đã hết hạn. Hãy nhờ khu vực trưởng cấp lại." };
  } else if (!(await verify(user.passwordHash, current))) {
    return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hash(next), mustChangePassword: false, tempPasswordExpiresAt: null })
    .where(eq(users.id, userId));
  await revokeAllSessions(userId);
  return { ok: true, ...(await createSession(userId)) };
}
