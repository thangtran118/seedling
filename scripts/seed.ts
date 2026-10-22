// Seeds FAKE data only. Real data must wait for the legal gate (see design doc, Dependencies).
// Usage: pnpm db:seed   (wipes all tables first)
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { db, sqlClient } from "../src/db";
import * as s from "../src/db/schema";

const DEV_PASSWORD = "seedling-dev";
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function wipe() {
  await sqlClient`truncate private.session_private, private.listener_private, pii_access_log,
    session_lessons, session_listeners, session_members, sessions, listener_links, listeners,
    login_attempts, auth_sessions, users, areas cascade`;
}

async function main() {
  await wipe();
  const passwordHash = await hash(DEV_PASSWORD);

  const [area] = await db.insert(s.areas).values({ name: "Khu vực Thử nghiệm" }).returning();

  const people = [
    { name: "Trưởng Khu Vực", phone: "0900000001", role: "area_leader" as const },
    { name: "ae An", phone: "0900000002", role: "member" as const },
    { name: "ae Bình", phone: "0900000003", role: "member" as const },
    { name: "ae Chi", phone: "0900000004", role: "member" as const },
    { name: "ae Dũng", phone: "0900000005", role: "member" as const },
  ];
  const users = await db
    .insert(s.users)
    .values(
      people.map((p) => ({
        ...p,
        passwordHash,
        areaId: area.id,
        mustChangePassword: false,
        consentedAt: nfew Date(),
      })),
    )
    .returning();
  const [leader, an, binh, chi, dung] = users;

  const listenerSeed = [
    { name: "Chiên 1", birthYear: 1998, status: "goi_mo" as const, owner: an, phone: "0999000001" },
    { name: "Chiên 2", birthYear: 2001, status: "moi_quen" as const, owner: an, phone: "0999000002" },
    { name: "Chiên 3", birthYear: 1995, status: "goi_mo" as const, owner: binh, phone: "0999000003" },
    { name: "Chiên 4", birthYear: 1990, status: "baptem" as const, owner: binh, phone: null },
    { name: "Chiên 5", birthYear: null, status: "tu_choi" as const, owner: chi, phone: null },
    { name: "Chiên 6", birthYear: 2003, status: "moi_quen" as const, owner: dung, phone: "0999000006" },
  ];
  const listeners: (typeof s.listeners.$inferSelect)[] = [];
  for (const l of listenerSeed) {
    const [row] = await db
      .insert(s.listeners)
      .values({ areaId: area.id, name: l.name, birthYear: l.birthYear, manualStatus: l.status, createdBy: l.owner.id })
      .returning();
    await db.insert(s.listenerLinks).values({ listenerId: row.id, userId: l.owner.id, addedBy: l.owner.id });
    await db.insert(s.listenerPrivate).values({
      listenerId: row.id,
      phone: l.phone,
      hometown: "Quê giả",
      notes: "Ghi chú giả: thích uống trà",
    });
    listeners.push(row);
  }

  // Done sessions with lesson history; listener 2 and 6 have none (should top the stalled list).
  const history: Array<{ listener: number; members: (typeof users)[number][]; ago: number; lessons: number[] }> = [
    { listener: 0, members: [an, binh], ago: 30, lessons: [1] },
    { listener: 0, members: [an, chi], ago: 23, lessons: [2] },
    { listener: 0, members: [an, binh], ago: 5, lessons: [3] },
    { listener: 2, members: [binh, dung], ago: 40, lessons: [2] },
    { listener: 2, members: [binh, an], ago: 26, lessons: [4] }, // catches up to mảnh 4 in one sitting; 3 is implied
    { listener: 3, members: [binh, chi], ago: 60, lessons: [7] },
  ];
  for (const h of history) {
    const [session] = await db
      .insert(s.sessions)
      .values({
        areaId: area.id,
        createdBy: h.members[0].id,
        startsAt: daysAgo(h.ago),
        locationLabel: "Quán cafe Kết 3",
        state: "done",
      })
      .returning();
    await db.insert(s.sessionMembers).values(h.members.map((m) => ({ sessionId: session.id, userId: m.id })));
    await db.insert(s.sessionListeners).values({ sessionId: session.id, listenerId: listeners[h.listener].id });
    await db
      .insert(s.sessionLessons)
      .values(h.lessons.map((lesson) => ({ sessionId: session.id, listenerId: listeners[h.listener].id, lesson })));
    await db.insert(s.sessionPrivate).values({
      sessionId: session.id,
      locationDetail: "Địa chỉ giả 123",
      summary: "Tóm tắt giả",
    });
  }

  // One upcoming planned session others can join.
  const [planned] = await db
    .insert(s.sessions)
    .values({
      areaId: area.id,
      createdBy: an.id,
      startsAt: new Date(Date.now() + 2 * DAY),
      locationLabel: "Quán cafe Kết 1",
      state: "planned",
    })
    .returning();
  await db.insert(s.sessionMembers).values({ sessionId: planned.id, userId: an.id });
  await db.insert(s.sessionListeners).values({ sessionId: planned.id, listenerId: listeners[0].id });

  // Calendar and "đang diễn ra" demo: one session in progress, one past its window, one cancelled, a few done.
  const HOUR = 60 * 60 * 1000;
  const extra: Array<{
    listener: number;
    members: (typeof users)[number][];
    at: Date;
    state: "planned" | "done" | "cancelled";
    place: string;
    lessons?: number[];
  }> = [
    { listener: 2, members: [binh, dung], at: new Date(Date.now() - 40 * 60 * 1000), state: "planned", place: "Quán cafe Kết 10" },
    {
      listener: 1,
      members: [an, chi],
      at: new Date(Date.now() - DAY - 3 * HOUR),
      state: "planned",
      place: "Bình Thạnh",
    },
    { listener: 5, members: [dung], at: new Date(Date.now() + 5 * HOUR), state: "planned", place: "Quán cafe Kết 5" },
    { listener: 5, members: [dung, an], at: daysAgo(3), state: "cancelled", place: "Quán cafe Kết 5" },
    { listener: 0, members: [an, chi], at: daysAgo(2), state: "done", place: "Quán cafe Kết 3", lessons: [4] },
    { listener: 2, members: [binh, chi, dung], at: daysAgo(12), state: "done", place: "Quán cafe Kết 10", lessons: [5] },
    { listener: 1, members: [an, dung], at: new Date(Date.now() + 4 * DAY), state: "planned", place: "Quán cafe Kết 1" },
  ];
  for (const e of extra) {
    const [session] = await db
      .insert(s.sessions)
      .values({ areaId: area.id, createdBy: e.members[0].id, startsAt: e.at, locationLabel: e.place, state: e.state })
      .returning();
    await db.insert(s.sessionMembers).values(e.members.map((m) => ({ sessionId: session.id, userId: m.id })));
    await db.insert(s.sessionListeners).values({ sessionId: session.id, listenerId: listeners[e.listener].id });
    if (e.lessons?.length) {
      await db
        .insert(s.sessionLessons)
        .values(e.lessons.map((lesson) => ({ sessionId: session.id, listenerId: listeners[e.listener].id, lesson })));
    }
  }

  console.log(`Seeded fake data. Area leader: ${leader.phone}, members: 0900000002..05, password: ${DEV_PASSWORD}`);
}

main()
  .then(() => sqlClient.end())
  .catch(async (err) => {
    console.error(err);
    await sqlClient.end();
    process.exit(1);
  });
