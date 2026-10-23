// Schema follows the approved design doc (office-hours 2026-10-18).
// Sensitive listener/session fields live in the separate Postgres schema "private"
// and must only be read through src/lib/access/.
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["member", "area_leader"]);
export const manualStatusEnum = pgEnum("manual_status", ["moi_quen", "goi_mo", "baptem", "tu_choi"]);
export const sessionStateEnum = pgEnum("session_state", ["planned", "cancelled"]);

export const areas = pgTable("areas", {
  id: id(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  areaId: uuid("area_id")
    .notNull()
    .references(() => areas.id),
  role: roleEnum("role").notNull().default("member"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  tempPasswordExpiresAt: timestamp("temp_password_expires_at", { withTimezone: true }),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const authSessions = pgTable("auth_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id")
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
    areaId: uuid("area_id")
      .notNull()
      .references(() => areas.id),
    name: varchar("name", { length: 100 }).notNull(),
    birthYear: smallint("birth_year"),
    manualStatus: manualStatusEnum("manual_status").notNull().default("moi_quen"),
    // Highest mảnh reached, set directly on the listener (0 = none yet).
    lessonsReached: smallint("lessons_reached").notNull().default(0),
    // When the listener first reached mảnh 1 and when they were marked báptem (null when not / no longer): the
    // monthly stats count each listener from these moments.
    firstLessonAt: timestamp("first_lesson_at", { withTimezone: true }),
    baptizedAt: timestamp("baptized_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [check("lessons_reached_range", sql`${t.lessonsReached} between 0 and 7`)],
);

export const listenerLinks = pgTable(
  "listener_links",
  {
    listenerId: uuid("listener_id")
      .notNull()
      .references(() => listeners.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listenerId, t.userId] })],
);

export const sessions = pgTable("sessions", {
  id: id(),
  areaId: uuid("area_id")
    .notNull()
    .references(() => areas.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  locationLabel: varchar("location_label", { length: 80 }),
  mapUrl: varchar("map_url", { length: 500 }),
  state: sessionStateEnum("state").notNull(),
  cancelledBy: uuid("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sessionMembers = pgTable(
  "session_members",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const sessionListeners = pgTable(
  "session_listeners",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    listenerId: uuid("listener_id")
      .notNull()
      .references(() => listeners.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.listenerId] })],
);

export const piiAccessLog = pgTable("pii_access_log", {
  id: id(),
  viewerId: uuid("viewer_id")
    .notNull()
    .references(() => users.id),
  listenerId: uuid("listener_id").references(() => listeners.id),
  sessionId: uuid("session_id").references(() => sessions.id),
  targetUserId: uuid("target_user_id").references(() => users.id),
  reason: varchar("reason", { length: 50 }).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const privateSchema = pgSchema("private");

export const listenerPrivate = privateSchema.table("listener_private", {
  listenerId: uuid("listener_id")
    .primaryKey()
    .references(() => listeners.id),
  phone: varchar("phone", { length: 20 }),
  hometown: varchar("hometown", { length: 100 }),
  facebook: varchar("facebook", { length: 200 }),
  zalo: varchar("zalo", { length: 200 }),
  telegram: varchar("telegram", { length: 200 }),
  notes: text("notes"),
});

export const sessionPrivate = privateSchema.table("session_private", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id),
  summary: text("summary"),
});
