import "server-only";
import { and, asc, desc, eq, ilike, inArray, lte, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  listenerLinks,
  listenerNotes,
  listenerPrivate,
  listeners,
  piiAccessLog,
  sessionListeners,
  sessionMembers,
  sessions,
  users,
} from "@/db/schema";
import {
  ageFromBirthYear,
  stageOf,
  DEFAULT_ROUTE,
  ROUTES,
  type ManualStatus,
  type Progress,
  type Route,
  type SessionState,
  type Stage,
} from "@/lib/domain";
import type { SessionUser } from "./auth";
import { completedAt } from "./phase";
import { forbiddenError, invalidError } from "./errors";
import { cleanNoteBody, notesFor, type ListenerNote } from "./notes";
import { pickedOrOwnArea } from "./areas";
import { canAddLinks, canRemoveLinks, canSeeContact, inRegion, isRegionLeader, requireInRegion } from "./scope";

// ---------- DTOs: the only listener shapes that leave the access layer ----------

export type ListenerSummary = {
  id: number;
  name: string;
  age: number | null;
  stage: Stage;
  manualStatus: ManualStatus;
  route: Route;
  lessons: number[];
  area: { id: number; name: string }; // the listener's area (its creator's)
  otherArea: string | null; // that area's name when it is not the viewer's own, for a tag on the card
  linked: boolean;
  owners: string[]; // names of the linked users (người đồng hành)
  lastDoneAt: Date | null;
};

export type ListenerPrivateFields = {
  phone: string | null;
  hometown: string | null;
  facebook: string | null;
  zalo: string | null;
  telegram: string | null;
};

export type ListenerHistoryItem = {
  sessionId: number;
  startsAt: Date;
  state: SessionState;
  locationLabel: string | null;
  members: string[];
};

export type ListenerDetail = ListenerSummary & {
  birthYear: number | null;
  links: { userId: number; name: string; primary: boolean }[]; // primary: created the listener, cannot be removed
  canEdit: boolean;
  canManageLinks: boolean; // add a người đồng hành
  canRemoveLinks: boolean;
  private: ListenerPrivateFields | null; // null when the viewer may not see it
  notes: ListenerNote[]; // newest first; the whole region reads them
  history: ListenerHistoryItem[];
};

// ---------- shared queries ----------

// User-typed search text must not act as LIKE wildcards.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function isLinked(userId: number, listenerId: number) {
  const [row] = await db
    .select({ one: sql`1` })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.userId, userId), eq(listenerLinks.listenerId, listenerId)));
  return Boolean(row);
}

// Progress is sequential: reaching lesson N counts 1..N-1 as heard too, so only the highest lesson reached
// (set directly on the listener) is stored — this fills that in as a contiguous 1..N run per listener, on the
// listener's route.
export async function lessonsHeardFor(listenerIds: number[]): Promise<Map<number, { route: Route; heard: number[] }>> {
  const result = new Map<number, { route: Route; heard: number[] }>(
    listenerIds.map((id) => [id, { route: DEFAULT_ROUTE, heard: [] }]),
  );
  if (listenerIds.length === 0) return result;
  const rows = await db
    .select({ id: listeners.id, route: listeners.route, latest: listeners.lessonsReached })
    .from(listeners)
    .where(inArray(listeners.id, listenerIds));
  for (const r of rows) result.set(r.id, { route: r.route, heard: Array.from({ length: r.latest }, (_, i) => i + 1) });
  return result;
}

async function lastDoneFor(listenerIds: number[]): Promise<Map<number, Date>> {
  if (listenerIds.length === 0) return new Map();
  const rows = await db
    .select({ listenerId: sessionListeners.listenerId, last: max(sessions.startsAt) })
    .from(sessionListeners)
    .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
    .where(and(inArray(sessionListeners.listenerId, listenerIds), completedAt(new Date())))
    .groupBy(sessionListeners.listenerId);
  return new Map(rows.filter((r) => r.last).map((r) => [r.listenerId, r.last as Date]));
}

async function summarize(viewer: SessionUser, rows: (typeof listeners.$inferSelect)[]): Promise<ListenerSummary[]> {
  const ids = rows.map((r) => r.id);
  const [lessons, lastDone, areaRows, links] = await Promise.all([
    lessonsHeardFor(ids),
    lastDoneFor(ids),
    ids.length
      ? db
          .select({ id: areas.id, name: areas.name })
          .from(areas)
          .where(inArray(areas.id, [...new Set(rows.map((r) => r.areaId))]))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ listenerId: listenerLinks.listenerId, userId: users.id, name: users.name })
          .from(listenerLinks)
          .innerJoin(users, eq(users.id, listenerLinks.userId))
          .where(inArray(listenerLinks.listenerId, ids))
          .orderBy(asc(listenerLinks.createdAt))
      : Promise.resolve([]),
  ]);
  const linkedIds = new Set(links.filter((l) => l.userId === viewer.id).map((l) => l.listenerId));
  const areaName = (id: number) => areaRows.find((a) => a.id === id)?.name ?? "";
  return rows.map((r) => {
    const heard = lessons.get(r.id)?.heard ?? [];
    return {
      id: r.id,
      name: r.name,
      age: ageFromBirthYear(r.birthYear),
      stage: stageOf({ manualStatus: r.manualStatus, lessons: heard.length }),
      manualStatus: r.manualStatus,
      route: r.route,
      lessons: heard,
      area: { id: r.areaId, name: areaName(r.areaId) },
      otherArea: r.areaId === viewer.areaId ? null : areaName(r.areaId),
      linked: linkedIds.has(r.id),
      owners: links.filter((l) => l.listenerId === r.id).map((l) => l.name),
      lastDoneAt: lastDone.get(r.id) ?? null,
    };
  });
}

async function loadInRegion(viewer: SessionUser, listenerId: number) {
  const [row] = await db.select().from(listeners).where(eq(listeners.id, listenerId));
  // A listener of another region simply does not exist for this viewer.
  requireInRegion(viewer, row, "Không tìm thấy chiên.");
  return row;
}

async function logAccess(entry: typeof piiAccessLog.$inferInsert) {
  await db.insert(piiAccessLog).values(entry);
}

// ---------- reads ----------

export type ListenerListItem = ListenerSummary & {
  mine: boolean; // "Chiên bạn np": linked to the viewer, or the viewer has been on a session with them
};

// Listeners the viewer has been on a session with: started (not only planned) and not cancelled.
async function wentWithIds(viewer: SessionUser, listenerIds: number[]): Promise<Set<number>> {
  if (listenerIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: sessionListeners.listenerId })
    .from(sessionListeners)
    .innerJoin(sessionMembers, eq(sessionMembers.sessionId, sessionListeners.sessionId))
    .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
    .where(
      and(
        eq(sessionMembers.userId, viewer.id),
        ne(sessions.state, "cancelled"),
        lte(sessions.startsAt, new Date()),
        inArray(sessionListeners.listenerId, listenerIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

// The listener list: everyone in the region sees every listener of the region, as a summary only (name, age, status,
// lessons; contact details stay behind the listener page's own checks). `areaId` narrows it to one area of the
// region (callers check it with loadAreaInRegion). `mine` marks the viewer's own ones ("Chiên bạn np").
export async function listListeners(
  viewer: SessionUser,
  opts: { query?: string; areaId?: number } = {},
): Promise<ListenerListItem[]> {
  const q = opts.query?.trim();
  const rows = await db
    .select()
    .from(listeners)
    .where(
      and(
        eq(listeners.regionId, viewer.regionId),
        opts.areaId ? eq(listeners.areaId, opts.areaId) : undefined,
        q ? ilike(listeners.name, `%${escapeLike(q)}%`) : undefined,
      ),
    )
    .orderBy(asc(listeners.name));
  const [summaries, went] = await Promise.all([
    summarize(viewer, rows),
    wentWithIds(
      viewer,
      rows.map((r) => r.id),
    ),
  ]);
  return summaries.map((l) => ({ ...l, mine: l.linked || went.has(l.id) }));
}

// Leader view of one member's listeners (the member stats page, which checks the viewer leads that member's area).
// Same summary shape as the list.
export async function listListenersLinkedTo(viewer: SessionUser, userId: number): Promise<ListenerSummary[]> {
  const rows = await db
    .select()
    .from(listeners)
    .where(
      and(
        eq(listeners.regionId, viewer.regionId),
        inArray(
          listeners.id,
          db.select({ id: listenerLinks.listenerId }).from(listenerLinks).where(eq(listenerLinks.userId, userId)),
        ),
      ),
    )
    .orderBy(asc(listeners.name));
  return summarize(viewer, rows);
}

export type SessionListener = ListenerSummary & {
  private: ListenerPrivateFields | null;
  notes: ListenerNote[]; // newest first
  history: ListenerHistoryItem[];
};

// Listeners as shown on a session page, in the given order. Callers pass the listeners of a session the viewer
// may open (getSessionDetail checks that). Contact fields follow the listener rule (scope.canSeeContact); history and
// notes are open to the region. Each read is logged exactly like the listener page.
export async function listenersForSession(viewer: SessionUser, listenerIds: number[]): Promise<SessionListener[]> {
  if (listenerIds.length === 0) return [];
  const rows = await db
    .select()
    .from(listeners)
    .where(and(inArray(listeners.id, listenerIds), eq(listeners.regionId, viewer.regionId)));
  const summaries = await summarize(viewer, rows);
  const allowed = summaries
    .filter((l) => canSeeContact(viewer, { areaId: l.area.id, regionId: viewer.regionId }, l.linked))
    .map((l) => l.id);
  const privateRows = allowed.length
    ? await db.select().from(listenerPrivate).where(inArray(listenerPrivate.listenerId, allowed))
    : [];
  if (allowed.length) {
    await db
      .insert(piiAccessLog)
      .values(allowed.map((listenerId) => ({ viewerId: viewer.id, listenerId, reason: "view_listener_private" })));
  }
  const withNotes = summaries.map((l) => l.id);
  if (withNotes.length) {
    await db
      .insert(piiAccessLog)
      .values(withNotes.map((listenerId) => ({ viewerId: viewer.id, listenerId, reason: "view_listener_history" })));
  }
  const [notes, histories] = await Promise.all([
    notesFor(viewer, withNotes),
    Promise.all(withNotes.map(async (id) => [id, await listenerHistory(id)] as const)).then((e) => new Map(e)),
  ]);
  const byId = new Map(summaries.map((l) => [l.id, l]));
  return listenerIds.flatMap((id) => {
    const l = byId.get(id);
    if (!l) return [];
    const p = privateRows.find((r) => r.listenerId === id);
    return [
      {
        ...l,
        private: allowed.includes(id)
          ? {
              phone: p?.phone ?? null,
              hometown: p?.hometown ?? null,
              facebook: p?.facebook ?? null,
              zalo: p?.zalo ?? null,
              telegram: p?.telegram ?? null,
            }
          : null,
        notes: notes.get(id) ?? [],
        history: histories.get(id) ?? [],
      },
    ];
  });
}

export async function getListenerDetail(viewer: SessionUser, listenerId: number): Promise<ListenerDetail> {
  const row = await loadInRegion(viewer, listenerId);
  const [summary] = await summarize(viewer, [row]);

  const links = (
    await db
      .select({ userId: users.id, name: users.name })
      .from(listenerLinks)
      .innerJoin(users, eq(users.id, listenerLinks.userId))
      .where(eq(listenerLinks.listenerId, listenerId))
      .orderBy(asc(listenerLinks.createdAt))
  ).map((link) => ({ ...link, primary: link.userId === row.createdBy }));

  const canViewPrivate = canSeeContact(viewer, row, summary.linked);
  let privateFields: ListenerPrivateFields | null = null;
  if (canViewPrivate) {
    const [p] = await db.select().from(listenerPrivate).where(eq(listenerPrivate.listenerId, listenerId));
    privateFields = {
      phone: p?.phone ?? null,
      hometown: p?.hometown ?? null,
      facebook: p?.facebook ?? null,
      zalo: p?.zalo ?? null,
      telegram: p?.telegram ?? null,
    };
    await logAccess({ viewerId: viewer.id, listenerId, reason: "view_listener_private" });
  }

  // The whole region reads the history and notes (not the contact fields); every read is logged.
  await logAccess({ viewerId: viewer.id, listenerId, reason: "view_listener_history" });

  return {
    ...summary,
    birthYear: row.birthYear,
    links,
    canEdit: summary.linked,
    canManageLinks: canAddLinks(viewer, row, summary.linked),
    canRemoveLinks: canRemoveLinks(viewer, row),
    private: privateFields,
    notes: (await notesFor(viewer, [listenerId])).get(listenerId) ?? [],
    history: await listenerHistory(listenerId),
  };
}

async function listenerHistory(listenerId: number): Promise<ListenerHistoryItem[]> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      startsAt: sessions.startsAt,
      state: sessions.state,
      locationLabel: sessions.locationLabel,
    })
    .from(sessionListeners)
    .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
    .where(eq(sessionListeners.listenerId, listenerId))
    .orderBy(desc(sessions.startsAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.sessionId);
  const members = await db
    .select({ sessionId: sessionMembers.sessionId, name: users.name })
    .from(sessionMembers)
    .innerJoin(users, eq(users.id, sessionMembers.userId))
    .where(inArray(sessionMembers.sessionId, ids));
  return rows.map((r) => ({
    ...r,
    members: members.filter((m) => m.sessionId === r.sessionId).map((m) => m.name),
  }));
}

// Possible duplicates shown before a new listener is created (same region, name contains/contained): several areas
// may meet the same person.
export async function findSimilarListeners(viewer: SessionUser, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return [];
  const needle = escapeLike(trimmed.toLowerCase());
  return db
    .select({ id: listeners.id, name: listeners.name, birthYear: listeners.birthYear })
    .from(listeners)
    .where(
      and(
        eq(listeners.regionId, viewer.regionId),
        sql`(lower(${listeners.name}) like ${"%" + needle + "%"} or ${trimmed.toLowerCase()} like '%' || lower(${listeners.name}) || '%')`,
      ),
    )
    .limit(5);
}

// ---------- writes ----------

export type ListenerInput = {
  name: string;
  birthYear: number | null;
  private: ListenerPrivateFields;
};

function validateListenerInput(input: ListenerInput) {
  const name = input.name.trim();
  if (!name) throw invalidError("Cần nhập tên chiên.");
  if (name.length > 100) throw invalidError("Tên quá dài.");
  const year = new Date().getFullYear();
  if (input.birthYear !== null && (input.birthYear < 1900 || input.birthYear > year)) {
    throw invalidError("Năm sinh không hợp lệ.");
  }
  const clean = (v: string | null, maxLen: number) => {
    const t = v?.trim() ?? "";
    if (t.length > maxLen) throw invalidError("Một trường thông tin quá dài.");
    return t || null;
  };
  return {
    name,
    birthYear: input.birthYear,
    private: {
      phone: clean(input.private.phone, 20),
      hometown: clean(input.private.hometown, 100),
      facebook: clean(input.private.facebook, 200),
      zalo: clean(input.private.zalo, 200),
      telegram: clean(input.private.telegram, 200),
    },
  };
}

const hasAny = (p: ListenerPrivateFields) => Object.values(p).some((v) => v !== null);

// The listener belongs to the creator's area; the region leader, who belongs to none, picks one (areaId).
export async function createListener(
  viewer: SessionUser,
  input: ListenerInput & { progress?: Progress; note?: string | null; areaId?: number },
): Promise<number> {
  const clean = validateListenerInput(input);
  const area = await pickedOrOwnArea(viewer, isRegionLeader(viewer) ? input.areaId : undefined);
  // The first note can be written with the new listener; later ones are added on the listener page.
  const note = input.note?.trim() ? cleanNoteBody(input.note) : null;
  // A listener may be added part-way: at lesson N of their route, or already báptem / từ chối.
  const { route, manualStatus, lessons } = input.progress ?? {
    route: DEFAULT_ROUTE,
    manualStatus: "moi_quen",
    lessons: 0,
  };
  checkLessons(route, lessons);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(listeners)
      .values({
        areaId: area.id,
        regionId: area.regionId,
        name: clean.name,
        birthYear: clean.birthYear,
        manualStatus,
        route,
        lessonsReached: lessons,
        firstLessonAt: lessons > 0 ? new Date() : null,
        baptizedAt: manualStatus === "baptem" ? new Date() : null,
        createdBy: viewer.id,
      })
      .returning({ id: listeners.id });
    await tx.insert(listenerLinks).values({ listenerId: row.id, userId: viewer.id, addedBy: viewer.id });
    if (hasAny(clean.private)) await tx.insert(listenerPrivate).values({ listenerId: row.id, ...clean.private });
    if (note) await tx.insert(listenerNotes).values({ listenerId: row.id, authorId: viewer.id, body: note });
    return row.id;
  });
}

async function requireLinked(viewer: SessionUser, listenerId: number) {
  await loadInRegion(viewer, listenerId);
  if (!(await isLinked(viewer.id, listenerId))) {
    throw forbiddenError("Chỉ người đồng hành của chiên này mới được sửa.");
  }
}

// Only directly linked users edit a listener; the area leader has no special edit right (design decision).
export async function updateListener(viewer: SessionUser, listenerId: number, input: ListenerInput) {
  await requireLinked(viewer, listenerId);
  const clean = validateListenerInput(input);
  await db.transaction(async (tx) => {
    await tx
      .update(listeners)
      .set({ name: clean.name, birthYear: clean.birthYear })
      .where(eq(listeners.id, listenerId));
    await tx
      .insert(listenerPrivate)
      .values({ listenerId, ...clean.private })
      .onConflictDoUpdate({ target: listenerPrivate.listenerId, set: clean.private });
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "edit_listener_private" });
  });
}

// The bound is checked here so a bad number reads as a message; the DB check "lessons_reached_range" backs it up.
function checkLessons(route: Route, lessons: number) {
  if (!(route in ROUTES)) throw invalidError("Lộ trình không hợp lệ.");
  if (!Number.isInteger(lessons) || lessons < 0 || lessons > ROUTES[route].count)
    throw invalidError("Bài không hợp lệ.");
}

// Route, stage and lesson are edited together on the listener page (lessons 0 = chưa nghe bài nào); sessions do
// not record lessons. `expectedRoute` is the saved route the page was showing: if someone has changed the route
// since, nothing is written (lesson 3 picked on route B must not land as F3).
export async function setProgress(viewer: SessionUser, listenerId: number, p: Progress & { expectedRoute: Route }) {
  await requireLinked(viewer, listenerId);
  checkLessons(p.route, p.lessons);
  const updated = await db
    .update(listeners)
    .set({
      route: p.route,
      manualStatus: p.manualStatus,
      lessonsReached: p.lessons,
      // Keeps the first time lesson 1 was reached. Going back to 0 on the same route means they have not heard it
      // after all; a route change (which starts at 0) keeps it, they did hear the truth.
      firstLessonAt:
        p.lessons > 0
          ? sql`coalesce(${listeners.firstLessonAt}, now())`
          : sql`case when ${listeners.route} = ${p.route} and ${listeners.lessonsReached} > 0 then null
              else ${listeners.firstLessonAt} end`,
      baptizedAt: p.manualStatus === "baptem" ? sql`coalesce(${listeners.baptizedAt}, now())` : null,
    })
    .where(and(eq(listeners.id, listenerId), eq(listeners.route, p.expectedRoute)))
    .returning({ id: listeners.id });
  if (updated.length === 0) throw invalidError("Lộ trình của chiên vừa được người khác đổi. Tải lại trang.");
}

// Linked users and the leaders of the listener's area may add a link (a leader adding themselves is how they gain edit
// rights). The person added may be from any area of the region.
export async function addLink(viewer: SessionUser, listenerId: number, targetUserId: number) {
  const row = await loadInRegion(viewer, listenerId);
  if (!canAddLinks(viewer, row, await isLinked(viewer.id, listenerId))) {
    throw forbiddenError("Chỉ người đồng hành hoặc khu vực trưởng mới được thêm người đồng hành.");
  }
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target || !target.active || !inRegion(viewer, target)) throw invalidError("Người được thêm không hợp lệ.");
  if (await isLinked(targetUserId, listenerId)) return;
  await db.transaction(async (tx) => {
    await tx.insert(listenerLinks).values({ listenerId, userId: targetUserId, addedBy: viewer.id });
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, targetUserId, reason: "link_added" });
  });
}

// Removing links is a leader action. The person who created the listener (người đồng hành chính) stays, so every
// listener keeps at least that one link and stays editable.
export async function removeLink(viewer: SessionUser, listenerId: number, targetUserId: number) {
  const row = await loadInRegion(viewer, listenerId);
  if (!canRemoveLinks(viewer, row)) throw forbiddenError("Chỉ khu vực trưởng mới được bỏ người đồng hành.");
  if (targetUserId === row.createdBy) throw invalidError("Không thể bỏ người đồng hành chính (người tạo chiên).");
  await db.transaction(async (tx) => {
    const links = await tx
      .select({ userId: listenerLinks.userId })
      .from(listenerLinks)
      .where(eq(listenerLinks.listenerId, listenerId))
      .for("update");
    if (!links.some((l) => l.userId === targetUserId)) return;
    if (links.length <= 1) throw invalidError("Không thể bỏ người đồng hành cuối cùng.");
    await tx
      .delete(listenerLinks)
      .where(and(eq(listenerLinks.listenerId, listenerId), eq(listenerLinks.userId, targetUserId)));
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, targetUserId, reason: "link_removed" });
  });
}
