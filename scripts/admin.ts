// Operator CLI for things no one can do from inside the app (design doc: "Khởi tạo hệ thống", reviewer R3-1).
//
//   pnpm admin bootstrap --area "Khu vực A" --name "Nguyễn Văn B" --phone 0912345678 [--region "Địa vực X"]
//       Creates an area and its first area leader; prints a temporary password (72 h). The area joins the region
//       named by --region (created if missing), or the only region there is.
//   pnpm admin region-leader --phone 0912345678 [--replace]
//       Makes an existing account the region leader (địa vực trưởng) of its region; it keeps leading its own area,
//       whose current area leader becomes a member. Refuses while the region has an active region leader, unless
//       --replace: the old one then goes back to leading their own area (or to member if that is the same area).
//       The app never grants this role; this is the only way.
//   pnpm admin reset-leader --phone 0912345678
//       Issues a new temporary password, unlocks the account, signs out every device.
//   pnpm admin access-log [--days 7]
//       Prints who viewed private listener/session data (the MVP's only review screen for pii_access_log).
import "dotenv/config";
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";
import { hash } from "@node-rs/argon2";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db, sqlClient } from "../src/db";
import { areas, listeners, piiAccessLog, regions, users } from "../src/db/schema";
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function pickRegion(tx: Tx, name: string | undefined) {
  if (name?.trim()) {
    const [found] = await tx.select().from(regions).where(eq(regions.name, name.trim()));
    if (found) return found;
    const [created] = await tx.insert(regions).values({ name: name.trim() }).returning();
    return created;
  }
  const all = await tx.select().from(regions);
  if (all.length === 1) return all[0];
  if (all.length === 0) return (await tx.insert(regions).values({ name: "Địa vực" }).returning())[0];
  throw new Error(`several regions exist; pass --region (${all.map((r) => r.name).join(", ")})`);
}

async function bootstrap(opts: { area?: string; name?: string; phone?: string; region?: string }) {
  if (!opts.area?.trim() || !opts.name?.trim()) throw new Error("--area and --name are required");
  const phone = requirePhone(opts.phone);
  const password = tempPassword();
  await db.transaction(async (tx) => {
    const region = await pickRegion(tx, opts.region);
    const [area] = await tx.insert(areas).values({ name: opts.area!.trim(), regionId: region.id }).returning();
    await tx.insert(users).values({
      name: opts.name!.trim(),
      phone,
      areaId: area.id,
      regionId: region.id,
      role: "area_leader",
      passwordHash: await hash(password),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_TTL_MS),
    });
  });
  console.log(`Created area "${opts.area}" with leader ${phone}. Temporary password: ${password} (expires in 72 h)`);
}

async function regionLeader(opts: { phone?: string; replace?: boolean }) {
  const phone = requirePhone(opts.phone);
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.phone, phone));
    if (!user || !user.active) throw new Error(`no active account for ${phone}`);
    if (user.role === "region_leader") return console.log(`${user.name} is already the region leader.`);
    const current = await tx
      .select()
      .from(users)
      .where(and(eq(users.regionId, user.regionId), eq(users.role, "region_leader"), eq(users.active, true)));
    if (current.length && !opts.replace)
      throw new Error(`the region already has a region leader (${current[0].name}); pass --replace to hand it over`);
    for (const old of current) {
      // Back to leading their own area, unless that is the new leader's area (one leader per area).
      await tx
        .update(users)
        .set({ role: old.areaId === user.areaId ? "member" : "area_leader" })
        .where(eq(users.id, old.id));
    }
    // The new region leader leads their own area: its area leader steps down.
    await tx
      .update(users)
      .set({ role: "member" })
      .where(and(eq(users.areaId, user.areaId), eq(users.role, "area_leader"), ne(users.id, user.id)));
    await tx.update(users).set({ role: "region_leader" }).where(eq(users.id, user.id));
    console.log(`${user.name} (${phone}) is now the region leader.`);
  });
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
      region: { type: "string" },
      replace: { type: "boolean" },
      days: { type: "string" },
    },
  });
  if (command === "bootstrap") return bootstrap(values);
  if (command === "region-leader") return regionLeader(values);
  if (command === "reset-leader") return resetLeader(values);
  if (command === "access-log") return accessLog(values);
  throw new Error("usage: pnpm admin <bootstrap|region-leader|reset-leader|access-log> [options]");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
