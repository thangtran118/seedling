// Schema follows the approved design doc (office-hours 2026-10-18).
// Sensitive listener/session fields live in the separate Postgres schema "private"
// and must only be read through src/lib/access/.
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// region_leader (địa vực trưởng) oversees every area of the region and belongs to none (users.area_id is null). It is
// only ever written by the operator CLI (scripts/admin.ts region-leader).
export const roleEnum = pgEnum("role", ["member", "area_leader", "region_leader"]);
export const manualStatusEnum = pgEnum("manual_status", ["moi_quen", "goi_mo", "baptem", "tu_choi"]);
export const sessionStateEnum = pgEnum("session_state", ["planned", "cancelled"]);
// visit: meeting chosen listeners. outreach: going out to meet new people at a place (gõ cửa…), with no listener.
export const sessionKindEnum = pgEnum("session_kind", ["visit", "outreach"]);
// Lộ trình nghe: Mảnh 1-7, B1-B12 or F1-F5 (domain.ts ROUTES).
export const listeningRouteEnum = pgEnum("listening_route", ["manh", "b", "f"]);

// Địa vực: a group of areas whose members trudo together. One region today; the table is there to grow into more.
export const regions = pgTable("regions", {
  id: id(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: createdAt(),
});

export const areas = pgTable(
  "areas",
  {
    id: id(),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: createdAt(),
  },
  // Target of the (area_id, region_id) foreign keys below.
  (t) => [unique("areas_id_region").on(t.id, t.regionId)],
);

// users, listeners and sessions carry region_id next to area_id so region-wide reads filter on one column. The
// composite foreign key keeps the pair equal to the area's own: it cannot drift, and moving an area to another region
// cascades.
const areaRegionFk = (name: string, t: { areaId: AnyPgColumn; regionId: AnyPgColumn }) =>
  foreignKey({ name, columns: [t.areaId, t.regionId], foreignColumns: [areas.id, areas.regionId] }).onUpdate("cascade");

export const users = pgTable(
  "users",
  {
    id: id(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    // Null for the region leader only (check below); everyone else belongs to one area.
    areaId: integer("area_id").references(() => areas.id),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id),
    role: roleEnum("role").notNull().default("member"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    tempPasswordExpiresAt: timestamp("temp_password_expires_at", { withTimezone: true }),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdBy: integer("created_by"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    areaRegionFk("users_area_region_fk", t),
    // Written with the older enum values only: a migration that adds region_leader cannot name it in its transaction.
    check("users_area_by_role", sql`(${t.areaId} is null) = (${t.role} not in ('member', 'area_leader'))`),
    // One area leader per area.
    uniqueIndex("one_leader_per_area")
      .on(t.areaId)
      .where(sql`${t.role} = 'area_leader' and ${t.active}`),
  ],
);

export const authSessions = pgTable("auth_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // sha256 of the cookie token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const loginAttempts = pgTable("login_attempts", {
  id: id(),
  phone: varchar("phone", { length: 20 }).notNull(),
  ip: varchar("ip", { length: 64 }),
  success: boolean("success").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const listeners = pgTable(
  "listeners",
  {
    id: id(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id),
    regionId: integer("region_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    birthYear: smallint("birth_year"),
    manualStatus: manualStatusEnum("manual_status").notNull().default("moi_quen"),
    route: listeningRouteEnum("route").notNull().default("manh"),
    // Highest lesson reached on that route, set directly on the listener (0 = none yet).
    lessonsReached: smallint("lessons_reached").notNull().default(0),
    // When the listener first reached lesson 1 (kept when the route changes) and when they were marked báptem
    // (null when not / no longer): the monthly stats count each listener from these moments.
    firstLessonAt: timestamp("first_lesson_at", { withTimezone: true }),
    baptizedAt: timestamp("baptized_at", { withTimezone: true }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  // Upper bound per route; keep in step with domain.ts ROUTES.
  (t) => [
    areaRegionFk("listeners_area_region_fk", t),
    check(
      "lessons_reached_range",
      sql`${t.lessonsReached} >= 0 and ${t.lessonsReached} <= case ${t.route} when 'b' then 12 when 'f' then 5 else 7 end`,
    ),
  ],
);

export const listenerLinks = pgTable(
  "listener_links",
  {
    listenerId: integer("listener_id")
      .notNull()
      .references(() => listeners.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    addedBy: integer("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listenerId, t.userId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    // The creator's area; null when the region leader created it: such a session belongs to every area of the region.
    areaId: integer("area_id").references(() => areas.id),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    kind: sessionKindEnum("kind").notNull().default("visit"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    locationLabel: varchar("location_label", { length: 80 }),
    mapUrl: varchar("map_url", { length: 500 }),
    state: sessionStateEnum("state").notNull(),
    cancelledBy: integer("cancelled_by").references(() => users.id),
    // AE chia sẻ chính: one member of a visit session who takes it on themselves (nobody assigns it to someone else).
    // Null until someone does; cleared when that member leaves the session.
    sharerId: integer("sharer_id").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [areaRegionFk("sessions_area_region_fk", t)],
);

export const sessionMembers = pgTable(
  "session_members",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const sessionListeners = pgTable(
  "session_listeners",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id),
    listenerId: integer("listener_id")
      .notNull()
      .references(() => listeners.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.listenerId] })],
);

export const piiAccessLog = pgTable("pii_access_log", {
  id: id(),
  viewerId: integer("viewer_id")
    .notNull()
    .references(() => users.id),
  listenerId: integer("listener_id").references(() => listeners.id),
  sessionId: integer("session_id").references(() => sessions.id),
  targetUserId: integer("target_user_id").references(() => users.id),
  reason: varchar("reason", { length: 50 }).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const privateSchema = pgSchema("private");

export const listenerPrivate = privateSchema.table("listener_private", {
  listenerId: integer("listener_id")
    .primaryKey()
    .references(() => listeners.id),
  phone: varchar("phone", { length: 20 }),
  hometown: varchar("hometown", { length: 100 }),
  facebook: varchar("facebook", { length: 200 }),
  zalo: varchar("zalo", { length: 200 }),
  telegram: varchar("telegram", { length: 200 }),
});

// Notes about a listener, many per listener, written whenever (often after a buổi trudo). Not tied to a session.
export const listenerNotes = privateSchema.table(
  "listener_notes",
  {
    id: id(),
    listenerId: integer("listener_id")
      .notNull()
      .references(() => listeners.id),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [index("listener_notes_listener_idx").on(t.listenerId, t.createdAt)],
);

export const sessionPrivate = privateSchema.table("session_private", {
  sessionId: integer("session_id")
    .primaryKey()
    .references(() => sessions.id),
  summary: text("summary"),
});
