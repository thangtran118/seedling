// Operator CLI for things no one can do from inside the app (design doc: "Khởi tạo hệ thống", reviewer R3-1).
//
//   pnpm admin bootstrap --area "Khu vực A" --name "Nguyễn Văn B" --phone 0912345678
//       Creates an area and its first area leader; prints a temporary password (72 h).
//   pnpm admin reset-leader --phone 0912345678
//       Issues a new temporary password, unlocks the account, signs out every device.
//   pnpm admin access-log [--days 7]
//       Prints who viewed private listener/session data (the MVP's only review screen for pii_access_log).
import "dotenv/config";
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";
import { hash } from "@node-rs/argon2";
import { desc, eq, gt } from "drizzle-orm";
import { db, sqlClient } from "../src/db";
import { areas, listeners, piiAccessLog, users } from "../src/db/schema";
import { normalizePhone } from "../src/lib/phone";

const TEMP_TTL_MS = 72 * 60 * 60 * 1000;

// Same format as src/lib/access/members.ts (which cannot be imported here: it is server-only).
function tempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return pick(letters, 4) + pick("23456789", 4);
}

function requirePhone(raw: string | undefined) {
  const phone = raw ? normalizePhone(raw) : null;
  if (!phone) throw new Error("--phone is missing or invalid");
  return phone;
}

async function bootstrap(opts: { area?: string; name?: string; phone?: string }) {
  if (!opts.area?.trim() || !opts.name?.trim()) throw new Error("--area and --name are required");
  const phone = requirePhone(opts.phone);
  const password = tempPassword();
  await db.transaction(async (tx) => {
    const [area] = await tx.insert(areas).values({ name: opts.area!.trim() }).returning();
    await tx.insert(users).values({
      name: opts.name!.trim(),
      phone,
      areaId: area.id,
      role: "area_leader",
      passwordHash: await hash(password),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_TTL_MS),
    });
  });
  console.log(`Created area "${opts.area}" with leader ${phone}. Temporary password: ${password} (expires in 72 h)`);
}

async function resetLeader(opts: { phone?: string }) {
  const phone = requirePhone(opts.phone);
  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user) throw new Error(`no account for ${phone}`);
  const password = tempPassword();
  await db
    .update(users)
    .set({
      passwordHash: await hash(password),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_TTL_MS),
      failedLogins: 0,
      lockedAt: null,
      active: true,
    })
    .where(eq(users.id, user.id));
  await sqlClient`update auth_sessions set revoked_at = now() where user_id = ${user.id} and revoked_at is null`;
  console.log(`Reset ${phone} (${user.name}). Temporary password: ${password} (expires in 72 h)`);
}

async function accessLog(opts: { days?: string }) {
  const days = Number(opts.days ?? 7);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      at: piiAccessLog.at,
      viewer: users.name,
      reason: piiAccessLog.reason,
      listener: listeners.name,
      sessionId: piiAccessLog.sessionId,
    })
    .from(piiAccessLog)
    .innerJoin(users, eq(users.id, piiAccessLog.viewerId))
    .leftJoin(listeners, eq(listeners.id, piiAccessLog.listenerId))
    .where(gt(piiAccessLog.at, since))
    .orderBy(desc(piiAccessLog.at));
  for (const r of rows) {
    console.log(
      `${r.at.toISOString()}  ${r.viewer.padEnd(24)} ${r.reason.padEnd(24)} ${r.listener ?? `session ${r.sessionId}`}`,
    );
  }
  console.log(`${rows.length} entries in the last ${days} day(s).`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      area: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      days: { type: "string" },
    },
  });
  if (command === "bootstrap") return bootstrap(values);
  if (command === "reset-leader") return resetLeader(values);
  if (command === "access-log") return accessLog(values);
  throw new Error("usage: pnpm admin <bootstrap|reset-leader|access-log> [options]");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
