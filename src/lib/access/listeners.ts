import "server-only";
import { and, asc, desc, eq, ilike, inArray, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
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
  LESSONS,
  type ManualStatus,
  type Progress,
  type SessionState,
  type Stage,
} from "@/lib/domain";
import type { SessionUser } from "./auth";
import { completedAt } from "./phase";
import { forbiddenError, invalidError, notFoundError } from "./errors";
import { cleanNoteBody, notesFor, type ListenerNote } from "./notes";

// ---------- DTOs: the only listener shapes that leave the access layer ----------

export type ListenerSummary = {
  id: string;
  name: string;
  age: number | null;
  stage: Stage;
  manualStatus: ManualStatus;
  lessons: number[];
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
  sessionId: string;
  startsAt: Date;
  state: SessionState;
  locationLabel: string | null;
  members: string[];
};

export type ListenerDetail = ListenerSummary & {
  birthYear: number | null;
  links: { userId: string; name: string; primary: boolean }[]; // primary: created the listener, cannot be removed
  canEdit: boolean;
  canManageLinks: boolean;
  private: ListenerPrivateFields | null; // null when the viewer may not see it
  notes: ListenerNote[] | null; // newest first; null with history (see historyVisibleListenerIds)
  history: ListenerHistoryItem[] | null; // null when the viewer may not see it, see historyVisibleListenerIds
};

// ---------- shared queries ----------

// User-typed search text must not act as LIKE wildcards.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function isLinked(userId: string, listenerId: string) {
  const [row] = await db
    .select({ one: sql`1` })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.userId, userId), eq(listenerLinks.listenerId, listenerId)));
  return Boolean(row);
}

// Listening history (which day each session was, who went) and the notes are visible to the listener's linked
// users, to anyone who went or is going on a session with them (cancelled ones do not count), and to the area
// leader. Returns the subset of listenerIds (all in the viewer's area) whose history this viewer may see.
export async function historyVisibleListenerIds(viewer: SessionUser, listenerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(listenerIds)];
  if (ids.length === 0) return new Set();
  if (viewer.role === "area_leader") return new Set(ids);
  const [linked, joined] = await Promise.all([
    db
      .select({ id: listenerLinks.listenerId })
      .from(listenerLinks)
      .where(and(eq(listenerLinks.userId, viewer.id), inArray(listenerLinks.listenerId, ids))),
    db
      .selectDistinct({ id: sessionListeners.listenerId })
      .from(sessionListeners)
      .innerJoin(sessionMembers, eq(sessionMembers.sessionId, sessionListeners.sessionId))
      .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
      .where(
        and(
          eq(sessionMembers.userId, viewer.id),
          ne(sessions.state, "cancelled"),
          inArray(sessionListeners.listenerId, ids),
        ),
      ),
  ]);
  return new Set([...linked, ...joined].map((r) => r.id));
}

// Progress is sequential: reaching lesson N counts 1..N-1 as heard too, so only the highest lesson reached
// (set directly on the listener) is stored — this fills that in as a contiguous 1..N run per listener.
export async function lessonsHeardFor(listenerIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>(listenerIds.map((id) => [id, []]));
  if (listenerIds.length === 0) return result;
  const rows = await db
    .select({ id: listeners.id, latest: listeners.lessonsReached })
    .from(listeners)
    .where(inArray(listeners.id, listenerIds));
  for (const r of rows)
    result.set(
      r.id,
      Array.from({ length: r.latest }, (_, i) => i + 1),
    );
  return result;
}

async function lastDoneFor(listenerIds: string[]): Promise<Map<string, Date>> {
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
  const [lessons, lastDone, links] = await Promise.all([
    lessonsHeardFor(ids),
    lastDoneFor(ids),
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
  return rows.map((r) => {
    const heard = lessons.get(r.id) ?? [];
    return {
      id: r.id,
      name: r.name,
      age: ageFromBirthYear(r.birthYear),
      stage: stageOf({ manualStatus: r.manualStatus, lessons: heard.length }),
      manualStatus: r.manualStatus,
      lessons: heard,
      linked: linkedIds.has(r.id),
      owners: links.filter((l) => l.listenerId === r.id).map((l) => l.name),
      lastDoneAt: lastDone.get(r.id) ?? null,
    };
  });
}

async function loadInArea(viewer: SessionUser, listenerId: string) {
  const [row] = await db.select().from(listeners).where(eq(listeners.id, listenerId));
  // Cross-area access is out of MVP scope: a listener from another area simply does not exist for this viewer.
  if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy chiên.");
  return row;
}

async function logAccess(entry: typeof piiAccessLog.$inferInsert) {
  await db.insert(piiAccessLog).values(entry);
}

// ---------- reads ----------

// The listener list: the area leader sees every listener of the area; a member sees only the listeners they are
// linked to, never those of other people in charge.
export async function listListeners(viewer: SessionUser, opts: { query?: string } = {}): Promise<ListenerSummary[]> {
  const q = opts.query?.trim();
  const rows = await db
    .select()
    .from(listeners)
    .where(
      and(
        eq(listeners.areaId, viewer.areaId),
        viewer.role === "area_leader"
          ? undefined
          : inArray(
              listeners.id,
              db
                .select({ id: listenerLinks.listenerId })
                .from(listenerLinks)
                .where(eq(listenerLinks.userId, viewer.id)),
            ),
        q ? ilike(listeners.name, `%${escapeLike(q)}%`) : undefined,
      ),
    )
    .orderBy(asc(listeners.name));
  const summaries = await summarize(viewer, rows);
  return summaries.sort((a, b) => Number(b.linked) - Number(a.linked));
}

// Leader view of one member's listeners (the member stats page). Same summary shape as the list.
export async function listListenersLinkedTo(viewer: SessionUser, userId: string): Promise<ListenerSummary[]> {
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng xem được.");
  const rows = await db
    .select()
    .from(listeners)
    .where(
      and(
        eq(listeners.areaId, viewer.areaId),
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
  notes: ListenerNote[] | null; // newest first; null with history (see historyVisibleListenerIds)
  history: ListenerHistoryItem[] | null;
};

// Listeners as shown on a session page, in the given order. Callers pass the listeners of a session the viewer
// may open (getSessionDetail checks that). Contact fields follow the listener rule: linked users and the area
// leader only; history and notes follow the history rule (people on a session with the listener too). Each read is logged
// exactly like the listener page.
export async function listenersForSession(viewer: SessionUser, listenerIds: string[]): Promise<SessionListener[]> {
  if (listenerIds.length === 0) return [];
  const rows = await db
    .select()
    .from(listeners)
    .where(and(inArray(listeners.id, listenerIds), eq(listeners.areaId, viewer.areaId)));
  const summaries = await summarize(viewer, rows);
  const allowed = summaries.filter((l) => l.linked || viewer.role === "area_leader").map((l) => l.id);
  const privateRows = allowed.length
    ? await db.select().from(listenerPrivate).where(inArray(listenerPrivate.listenerId, allowed))
    : [];
  if (allowed.length) {
    await db
      .insert(piiAccessLog)
      .values(allowed.map((listenerId) => ({ viewerId: viewer.id, listenerId, reason: "view_listener_private" })));
  }
  const withNotes = [...(await historyVisibleListenerIds(viewer, listenerIds))];
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
        notes: withNotes.includes(id) ? (notes.get(id) ?? []) : null,
        history: histories.get(id) ?? null,
      },
    ];
  });
}

export async function getListenerDetail(viewer: SessionUser, listenerId: string): Promise<ListenerDetail> {
  const row = await loadInArea(viewer, listenerId);
  const [summary] = await summarize(viewer, [row]);

  const links = (
    await db
      .select({ userId: users.id, name: users.name })
      .from(listenerLinks)
      .innerJoin(users, eq(users.id, listenerLinks.userId))
      .where(eq(listenerLinks.listenerId, listenerId))
      .orderBy(asc(listenerLinks.createdAt))
  ).map((link) => ({ ...link, primary: link.userId === row.createdBy }));

  const canViewPrivate = summary.linked || viewer.role === "area_leader";
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

  const canViewHistory = (await historyVisibleListenerIds(viewer, [listenerId])).has(listenerId);
  // People on a session with this listener read its history and notes (not the contact fields).
  if (canViewHistory) await logAccess({ viewerId: viewer.id, listenerId, reason: "view_listener_history" });

  return {
    ...summary,
    birthYear: row.birthYear,
    links,
    canEdit: summary.linked,
    canManageLinks: summary.linked || viewer.role === "area_leader",
    private: privateFields,
    notes: canViewHistory ? ((await notesFor(viewer, [listenerId])).get(listenerId) ?? []) : null,
    history: canViewHistory ? await listenerHistory(listenerId) : null,
  };
}

async function listenerHistory(listenerId: string): Promise<ListenerHistoryItem[]> {
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

// Possible duplicates shown before a new listener is created (same area, name contains/contained).
export async function findSimilarListeners(viewer: SessionUser, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return [];
  const needle = escapeLike(trimmed.toLowerCase());
  return db
    .select({ id: listeners.id, name: listeners.name, birthYear: listeners.birthYear })
    .from(listeners)
    .where(
      and(
        eq(listeners.areaId, viewer.areaId),
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

export async function createListener(
  viewer: SessionUser,
  input: ListenerInput & { progress?: Progress; note?: string | null },
): Promise<string> {
  const clean = validateListenerInput(input);
  // The first note can be written with the new listener; later ones are added on the listener page.
  const note = input.note?.trim() ? cleanNoteBody(input.note) : null;
  // A listener may be added part-way: at mảnh N, or already báptem / từ chối.
  const { manualStatus, lessons } = input.progress ?? { manualStatus: "moi_quen", lessons: 0 };
  if (!Number.isInteger(lessons) || lessons < 0 || lessons > LESSONS.length) throw invalidError("Mảnh không hợp lệ.");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(listeners)
      .values({
        areaId: viewer.areaId,
        name: clean.name,
        birthYear: clean.birthYear,
        manualStatus,
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

async function requireLinked(viewer: SessionUser, listenerId: string) {
  await loadInArea(viewer, listenerId);
  if (!(await isLinked(viewer.id, listenerId))) {
    throw forbiddenError("Chỉ người đồng hành của chiên này mới được sửa.");
  }
}

// Only directly linked users edit a listener; the area leader has no special edit right (design decision).
export async function updateListener(viewer: SessionUser, listenerId: string, input: ListenerInput) {
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

// Stage and mảnh are edited together on the listener page (lessons 0 = chưa nghe mảnh nào); sessions do not
// record lessons.
export async function setProgress(viewer: SessionUser, listenerId: string, p: Progress) {
  await requireLinked(viewer, listenerId);
  if (!Number.isInteger(p.lessons) || p.lessons < 0 || p.lessons > LESSONS.length)
    throw invalidError("Mảnh không hợp lệ.");
  await db
    .update(listeners)
    .set({
      manualStatus: p.manualStatus,
      lessonsReached: p.lessons,
      // Keeps the first time mảnh 1 was reached; going back to 0 means they have not heard it after all.
      firstLessonAt: p.lessons === 0 ? null : sql`coalesce(${listeners.firstLessonAt}, now())`,
      baptizedAt: p.manualStatus === "baptem" ? sql`coalesce(${listeners.baptizedAt}, now())` : null,
    })
    .where(eq(listeners.id, listenerId));
}

// Linked users and the area leader may add a link (a leader adding themselves is how they gain edit rights).
export async function addLink(viewer: SessionUser, listenerId: string, targetUserId: string) {
  await loadInArea(viewer, listenerId);
  if (viewer.role !== "area_leader" && !(await isLinked(viewer.id, listenerId))) {
    throw forbiddenError("Chỉ người đồng hành hoặc khu vực trưởng mới được thêm người đồng hành.");
  }
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target || !target.active || target.areaId !== viewer.areaId) throw invalidError("Người được thêm không hợp lệ.");
  if (await isLinked(targetUserId, listenerId)) return;
  await db.transaction(async (tx) => {
    await tx.insert(listenerLinks).values({ listenerId, userId: targetUserId, addedBy: viewer.id });
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, targetUserId, reason: "link_added" });
  });
}

// Removing links is a leader action. The person who created the listener (người đồng hành chính) stays, so every
// listener keeps at least that one link and stays editable.
export async function removeLink(viewer: SessionUser, listenerId: string, targetUserId: string) {
  const row = await loadInArea(viewer, listenerId);
  if (viewer.role !== "area_leader") throw forbiddenError("Chỉ khu vực trưởng mới được bỏ người đồng hành.");
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
