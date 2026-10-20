import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  listenerLinks,
  listeners,
  piiAccessLog,
  sessionLessons,
  sessionListeners,
  sessionMembers,
  sessionPrivate,
  sessions,
  users,
} from "@/db/schema";
import { DONE_FUTURE_TOLERANCE_MS, LESSONS, TIME_ZONE, type SessionState } from "@/lib/domain";
import type { SessionUser } from "./auth";
import { historyVisibleListenerIds, lessonsHeardFor } from "./listeners";
import { forbiddenError, invalidError, notFoundError } from "./errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------- DTOs ----------

export type SessionListItem = {
  id: string;
  startsAt: Date;
  state: SessionState;
  locationLabel: string | null;
  listeners: { id: string; name: string }[];
  members: { id: string; name: string }[];
  isMember: boolean;
  canJoin: boolean; // planned and the viewer is not in it yet (no member cap)
};

export type SessionDetail = SessionListItem & {
  createdBy: { id: string; name: string };
  lessons: Record<string, number[]>; // listenerId -> lessons shared in this session
  canEdit: boolean; // linked to at least one listener of the session
  canComplete: boolean; // planned, and linked to every listener of the session
  isPast: boolean;
  private: { locationDetail: string | null; summary: string | null } | null;
};

export type DuplicateInfo = {
  sessionId: string;
  state: SessionState;
  startsAt: Date;
  createdByName: string;
  listenerName: string;
};

export type WriteResult = { ok: true; id: string } | { ok: false; duplicates: DuplicateInfo[] };

export type CompositionInput = {
  listenerIds: string[];
  memberIds: string[]; // full member list; the acting user is added automatically when recording/planning
  lessons: Record<string, number[]>;
  meetOnly: boolean;
};

export type DetailsInput = {
  startsAt: Date;
  locationLabel: string | null;
  locationDetail: string | null;
  summary: string | null;
};

// ---------- helpers ----------

const unique = <T>(xs: T[]) => [...new Set(xs)];

function cleanText(value: string | null, maxLen: number, label: string) {
  const t = value?.trim() ?? "";
  if (t.length > maxLen) throw invalidError(`${label} dài quá ${maxLen} ký tự.`);
  return t || null;
}

function validateDetails(input: DetailsInput, opts: { done?: boolean } = {}) {
  if (Number.isNaN(input.startsAt.getTime())) throw invalidError("Thời gian không hợp lệ.");
  if (opts.done && input.startsAt.getTime() > Date.now() + DONE_FUTURE_TOLERANCE_MS) {
    throw invalidError("Ca đã đi không thể ở thời điểm trong tương lai.");
  }
  return {
    startsAt: input.startsAt,
    locationLabel: cleanText(input.locationLabel, 40, "Khu vực gặp"),
    locationDetail: cleanText(input.locationDetail, 200, "Địa chỉ chi tiết"),
    summary: cleanText(input.summary, 2000, "Tóm tắt"),
  };
}

async function validateComposition(
  viewer: SessionUser,
  input: CompositionInput,
  opts: { requireLessons: boolean; excludeSessionId?: string },
) {
  const listenerIds = unique(input.listenerIds);
  const memberIds = unique(input.memberIds);
  // Only the floor is checked: how many people go is up to the team.
  if (listenerIds.length < 1) throw invalidError("Chọn ít nhất một chiên.");
  if (memberIds.length < 1) throw invalidError("Cần ít nhất một người trudo.");

  const listenerRows = await db
    .select({ id: listeners.id })
    .from(listeners)
    .where(and(inArray(listeners.id, listenerIds), eq(listeners.areaId, viewer.areaId)));
  if (listenerRows.length !== listenerIds.length) throw invalidError("Chiên không hợp lệ.");

  const memberRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, memberIds), eq(users.areaId, viewer.areaId), eq(users.active, true)));
  if (memberRows.length !== memberIds.length) throw invalidError("Người trudo không hợp lệ.");

  // Progress is sequential: a session records the single lesson a chiên has now reached (earlier ones are
  // implied), so it must be strictly past whatever they had already reached elsewhere.
  const lessons: Record<string, number[]> = {};
  const targets = Object.keys(input.lessons).filter((id) => input.lessons[id]?.length);
  const priorMax = targets.length
    ? await lessonsHeardFor(targets, { excludeSessionId: opts.excludeSessionId })
    : new Map<string, number[]>();
  for (const [listenerId, ls] of Object.entries(input.lessons)) {
    if (!ls.length) continue;
    if (!listenerIds.includes(listenerId)) throw invalidError("Mảnh gắn với chiên không có trong ca.");
    const clean = unique(ls);
    if (clean.length > 1) throw invalidError("Mỗi chiên chỉ ghi một mảnh đạt được cho mỗi ca.");
    const [lesson] = clean;
    if (!LESSONS.includes(lesson as (typeof LESSONS)[number])) throw invalidError("Mảnh không hợp lệ.");
    const prior = priorMax.get(listenerId)?.length ?? 0;
    if (lesson <= prior) throw invalidError(`Đã đến mảnh ${prior}, chỉ ghi được mảnh ${prior + 1} trở lên.`);
    lessons[listenerId] = [lesson];
  }
  const anyLesson = Object.values(lessons).some((ls) => ls.length > 0);
  if (opts.requireLessons && !anyLesson && !input.meetOnly) {
    throw invalidError("Chọn ít nhất một mảnh, hoặc đánh dấu “chỉ gặp gỡ”.");
  }
  if (input.meetOnly && anyLesson) throw invalidError("Ca “chỉ gặp gỡ” không có mảnh.");
  return { listenerIds, memberIds, lessons };
}

// Same calendar day in Vietnam time, same listener, not cancelled.
async function findSameDay(
  listenerIds: string[],
  startsAt: Date,
  opts: { excludeSessionId?: string; states: SessionState[] },
): Promise<DuplicateInfo[]> {
  const day = sql`(${sessions.startsAt} at time zone ${TIME_ZONE})::date = (${startsAt.toISOString()}::timestamptz at time zone ${TIME_ZONE})::date`;
  const rows = await db
    .select({
      sessionId: sessions.id,
      state: sessions.state,
      startsAt: sessions.startsAt,
      createdByName: users.name,
      listenerName: listeners.name,
    })
    .from(sessionListeners)
    .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
    .innerJoin(listeners, eq(listeners.id, sessionListeners.listenerId))
    .innerJoin(users, eq(users.id, sessions.createdBy))
    .where(
      and(
        inArray(sessionListeners.listenerId, listenerIds),
        inArray(sessions.state, opts.states),
        opts.excludeSessionId ? ne(sessions.id, opts.excludeSessionId) : undefined,
        day,
      ),
    );
  return rows;
}

async function writeComposition(
  tx: Tx,
  sessionId: string,
  c: { listenerIds: string[]; memberIds: string[]; lessons: Record<string, number[]> },
) {
  await tx.delete(sessionLessons).where(eq(sessionLessons.sessionId, sessionId));
  await tx.delete(sessionListeners).where(eq(sessionListeners.sessionId, sessionId));
  await tx.delete(sessionMembers).where(eq(sessionMembers.sessionId, sessionId));
  await tx.insert(sessionListeners).values(c.listenerIds.map((listenerId) => ({ sessionId, listenerId })));
  await tx.insert(sessionMembers).values(c.memberIds.map((userId) => ({ sessionId, userId })));
  const lessonRows = Object.entries(c.lessons).flatMap(([listenerId, ls]) =>
    ls.map((lesson) => ({ sessionId, listenerId, lesson })),
  );
  if (lessonRows.length) await tx.insert(sessionLessons).values(lessonRows);
}

async function writePrivate(tx: Tx, sessionId: string, p: { locationDetail: string | null; summary: string | null }) {
  await tx
    .insert(sessionPrivate)
    .values({ sessionId, ...p })
    .onConflictDoUpdate({ target: sessionPrivate.sessionId, set: p });
}

async function loadSession(viewer: SessionUser, sessionId: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy ca.");
  return row;
}

async function sessionListenerIds(sessionId: string) {
  const rows = await db
    .select({ id: sessionListeners.listenerId })
    .from(sessionListeners)
    .where(eq(sessionListeners.sessionId, sessionId));
  return rows.map((r) => r.id);
}

async function sessionMemberIds(sessionId: string) {
  const rows = await db
    .select({ id: sessionMembers.userId })
    .from(sessionMembers)
    .where(eq(sessionMembers.sessionId, sessionId));
  return rows.map((r) => r.id);
}

async function linkedCount(userId: string, listenerIds: string[]) {
  if (listenerIds.length === 0) return 0;
  const rows = await db
    .select({ id: listenerLinks.listenerId })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.userId, userId), inArray(listenerLinks.listenerId, listenerIds)));
  return rows.length;
}

// Recording lessons ("ghi ca", "ghi kết quả") writes into each listener's history, so it needs a link to all of them.
async function requireLinkedToAll(viewer: SessionUser, listenerIds: string[]) {
  if ((await linkedCount(viewer.id, listenerIds)) !== listenerIds.length) {
    throw forbiddenError("Chỉ người đồng hành với tất cả chiên trong ca mới được ghi ca.");
  }
}

// Design decision: edit / cancel only by users linked to a listener of the session (completing needs all of them).
async function requireEditable(viewer: SessionUser, sessionId: string) {
  const row = await loadSession(viewer, sessionId);
  if ((await linkedCount(viewer.id, await sessionListenerIds(sessionId))) === 0) {
    throw forbiddenError("Chỉ người đồng hành với chiên trong ca mới được sửa ca này.");
  }
  return row;
}

// ---------- writes ----------

// "Ghi ca vừa xong": creates a done session directly. Only users linked to every listener in it may record.
export async function recordDoneSession(
  viewer: SessionUser,
  input: CompositionInput & DetailsInput & { confirmDistinct?: boolean },
): Promise<WriteResult> {
  const details = validateDetails(input, { done: true });
  const c = await validateComposition(
    viewer,
    { ...input, memberIds: [viewer.id, ...input.memberIds] },
    { requireLessons: true },
  );
  await requireLinkedToAll(viewer, c.listenerIds);
  if (!input.confirmDistinct) {
    const duplicates = await findSameDay(c.listenerIds, details.startsAt, { states: ["planned", "done"] });
    if (duplicates.length) return { ok: false, duplicates };
  }
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sessions)
      .values({
        areaId: viewer.areaId,
        createdBy: viewer.id,
        startsAt: details.startsAt,
        locationLabel: details.locationLabel,
        state: "done",
      })
      .returning({ id: sessions.id });
    await writeComposition(tx, row.id, c);
    await writePrivate(tx, row.id, details);
    return row.id;
  });
  return { ok: true, id };
}

// "Hẹn ca": planned session with the planner as first member; others join from the area calendar.
export async function planSession(
  viewer: SessionUser,
  input: { listenerIds: string[] } & DetailsInput & { confirmDistinct?: boolean },
): Promise<WriteResult> {
  const details = validateDetails(input);
  if (!details.locationLabel) throw invalidError("Cần nhập khu vực gặp để người khác biết mà tham gia.");
  const c = await validateComposition(
    viewer,
    { listenerIds: input.listenerIds, memberIds: [viewer.id], lessons: {}, meetOnly: false },
    { requireLessons: false },
  );
  if (!input.confirmDistinct) {
    const duplicates = await findSameDay(c.listenerIds, details.startsAt, { states: ["planned", "done"] });
    if (duplicates.length) return { ok: false, duplicates };
  }
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sessions)
      .values({
        areaId: viewer.areaId,
        createdBy: viewer.id,
        startsAt: details.startsAt,
        locationLabel: details.locationLabel,
        state: "planned",
      })
      .returning({ id: sessions.id });
    await writeComposition(tx, row.id, c);
    await writePrivate(tx, row.id, { locationDetail: details.locationDetail, summary: null });
    return row.id;
  });
  return { ok: true, id };
}

// Joining is only possible for planned sessions, so nobody can join an old session to read its notes.
export async function joinSession(viewer: SessionUser, sessionId: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy ca.");
    if (row.state !== "planned") throw invalidError("Chỉ tham gia được ca đang hẹn.");
    const members = await tx.select().from(sessionMembers).where(eq(sessionMembers.sessionId, sessionId));
    if (members.some((m) => m.userId === viewer.id)) return;
    await tx.insert(sessionMembers).values({ sessionId, userId: viewer.id });
  });
}

export async function leaveSession(viewer: SessionUser, sessionId: string) {
  const row = await loadSession(viewer, sessionId);
  if (row.state !== "planned") throw invalidError("Chỉ rời được ca đang hẹn.");
  const members = await sessionMemberIds(sessionId);
  if (!members.includes(viewer.id)) return;
  if (members.length <= 1) throw invalidError("Bạn là người duy nhất trong ca. Hãy hủy ca thay vì rời.");
  await db
    .delete(sessionMembers)
    .where(and(eq(sessionMembers.sessionId, sessionId), eq(sessionMembers.userId, viewer.id)));
}

// Planned -> done. Runs the same-day duplicate check against other done sessions.
export async function completeSession(
  viewer: SessionUser,
  sessionId: string,
  input: Omit<CompositionInput, "listenerIds"> & {
    summary: string | null;
    locationDetail: string | null;
    confirmDistinct?: boolean;
  },
): Promise<WriteResult> {
  const row = await requireEditable(viewer, sessionId);
  if (row.state !== "planned") throw invalidError("Ca này không ở trạng thái đang hẹn.");
  await requireLinkedToAll(viewer, await sessionListenerIds(sessionId));
  const details = validateDetails(
    { ...input, startsAt: row.startsAt, locationLabel: row.locationLabel },
    { done: true },
  );
  const c = await validateComposition(
    viewer,
    { ...input, listenerIds: await sessionListenerIds(sessionId) },
    { requireLessons: true },
  );
  if (!input.confirmDistinct) {
    const duplicates = await findSameDay(c.listenerIds, row.startsAt, {
      states: ["done"],
      excludeSessionId: sessionId,
    });
    if (duplicates.length) return { ok: false, duplicates };
  }
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ state: "done" }).where(eq(sessions.id, sessionId));
    await writeComposition(tx, sessionId, c);
    await writePrivate(tx, sessionId, details);
  });
  return { ok: true, id: sessionId };
}

// Edit date, place, people and lessons. Listener progress is derived, so it follows automatically.
export async function updateSession(
  viewer: SessionUser,
  sessionId: string,
  input: Omit<CompositionInput, "listenerIds"> & DetailsInput,
) {
  const row = await requireEditable(viewer, sessionId);
  if (row.state === "cancelled") throw invalidError("Không sửa được ca đã hủy.");
  const details = validateDetails(input, { done: row.state === "done" });
  const done = row.state === "done";
  const c = await validateComposition(
    viewer,
    { ...input, listenerIds: await sessionListenerIds(sessionId), lessons: done ? input.lessons : {} },
    { requireLessons: done, excludeSessionId: done ? sessionId : undefined },
  );
  const before = new Set(await sessionMemberIds(sessionId));
  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({ startsAt: details.startsAt, locationLabel: details.locationLabel })
      .where(eq(sessions.id, sessionId));
    await writeComposition(tx, sessionId, c);
    await writePrivate(tx, sessionId, details);
    if (done) {
      const added = c.memberIds.filter((id) => !before.has(id));
      if (added.length) {
        await tx.insert(piiAccessLog).values(
          added.map((targetUserId) => ({
            viewerId: viewer.id,
            sessionId,
            targetUserId,
            reason: "added_to_done_session",
          })),
        );
      }
    }
  });
}

// There is no delete: cancelling keeps every row and records who cancelled.
export async function cancelSession(viewer: SessionUser, sessionId: string) {
  const row = await requireEditable(viewer, sessionId);
  if (row.state === "cancelled") return;
  await db
    .update(sessions)
    .set({ state: "cancelled", cancelledBy: viewer.id, cancelledAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

// ---------- reads ----------

async function hydrate(viewer: SessionUser, rows: (typeof sessions.$inferSelect)[]): Promise<SessionListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [ls, ms] = await Promise.all([
    db
      .select({ sessionId: sessionListeners.sessionId, id: listeners.id, name: listeners.name })
      .from(sessionListeners)
      .innerJoin(listeners, eq(listeners.id, sessionListeners.listenerId))
      .where(inArray(sessionListeners.sessionId, ids)),
    db
      .select({ sessionId: sessionMembers.sessionId, id: users.id, name: users.name })
      .from(sessionMembers)
      .innerJoin(users, eq(users.id, sessionMembers.userId))
      .where(inArray(sessionMembers.sessionId, ids)),
  ]);
  return rows.map((r) => {
    const members = ms.filter((m) => m.sessionId === r.id).map(({ id, name }) => ({ id, name }));
    const isMember = members.some((m) => m.id === viewer.id);
    return {
      id: r.id,
      startsAt: r.startsAt,
      state: r.state,
      locationLabel: r.locationLabel,
      listeners: ls.filter((l) => l.sessionId === r.id).map(({ id, name }) => ({ id, name })),
      members,
      isMember,
      canJoin: r.state === "planned" && !isMember,
    };
  });
}

export async function getSessionDetail(viewer: SessionUser, sessionId: string): Promise<SessionDetail> {
  const row = await loadSession(viewer, sessionId);
  const [item] = await hydrate(viewer, [row]);
  const listenerIds = item.listeners.map((l) => l.id);
  // Planned sessions are public in the area so people can join; done and cancelled ones are listening history.
  if (!(await canSeeSession(viewer, item))) throw notFoundError("Không tìm thấy ca.");
  const [creator] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, row.createdBy));
  const lessonRows = await db
    .select({ listenerId: sessionLessons.listenerId, lesson: sessionLessons.lesson })
    .from(sessionLessons)
    .where(eq(sessionLessons.sessionId, sessionId))
    .orderBy(asc(sessionLessons.lesson));
  const lessons: Record<string, number[]> = {};
  for (const r of lessonRows) (lessons[r.listenerId] ??= []).push(r.lesson);

  const linkedTo = await linkedCount(viewer.id, listenerIds);
  const linked = linkedTo > 0;
  // Matrix: linked users and the area leader always; unlinked members only when they are in the session.
  const canSeePrivate = linked || item.isMember || viewer.role === "area_leader";
  let priv: SessionDetail["private"] = null;
  if (canSeePrivate) {
    const [p] = await db.select().from(sessionPrivate).where(eq(sessionPrivate.sessionId, sessionId));
    priv = { locationDetail: p?.locationDetail ?? null, summary: p?.summary ?? null };
    await db.insert(piiAccessLog).values({ viewerId: viewer.id, sessionId, reason: "view_session_private" });
  }
  return {
    ...item,
    createdBy: creator,
    lessons,
    canEdit: linked && row.state !== "cancelled",
    canComplete: row.state === "planned" && listenerIds.length > 0 && linkedTo === listenerIds.length,
    isPast: row.startsAt.getTime() < Date.now(),
    private: priv,
  };
}

// Area calendar: planned sessions from the start of today (Vietnam time).
export async function listAreaUpcoming(viewer: SessionUser): Promise<SessionListItem[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.areaId, viewer.areaId),
        eq(sessions.state, "planned"),
        sql`(${sessions.startsAt} at time zone ${TIME_ZONE})::date >= (now() at time zone ${TIME_ZONE})::date`,
      ),
    )
    .orderBy(asc(sessions.startsAt));
  return hydrate(viewer, rows);
}

export async function homeOverview(viewer: SessionUser) {
  const now = new Date();
  const myUpcoming = await db
    .select({ s: sessions })
    .from(sessions)
    .innerJoin(sessionMembers, eq(sessionMembers.sessionId, sessions.id))
    .where(and(eq(sessionMembers.userId, viewer.id), eq(sessions.state, "planned"), gte(sessions.startsAt, now)))
    .orderBy(asc(sessions.startsAt))
    .limit(10);

  // Past planned sessions that the viewer can complete (linked to a listener in them).
  const overdue = await db
    .selectDistinct({ s: sessions })
    .from(sessions)
    .innerJoin(sessionListeners, eq(sessionListeners.sessionId, sessions.id))
    .innerJoin(listenerLinks, eq(listenerLinks.listenerId, sessionListeners.listenerId))
    .where(
      and(
        eq(sessions.areaId, viewer.areaId),
        eq(sessions.state, "planned"),
        lt(sessions.startsAt, now),
        eq(listenerLinks.userId, viewer.id),
      ),
    )
    .orderBy(desc(sessions.startsAt))
    .limit(10);

  // Only those the viewer can actually complete: linked to every listener in them.
  const overdueItems = await hydrate(
    viewer,
    overdue.map((r) => r.s),
  );
  const linked = await db
    .select({ id: listenerLinks.listenerId })
    .from(listenerLinks)
    .where(eq(listenerLinks.userId, viewer.id));
  const linkedIds = new Set(linked.map((r) => r.id));

  return {
    upcoming: await hydrate(
      viewer,
      myUpcoming.map((r) => r.s),
    ),
    overdue: overdueItems.filter((s) => s.listeners.every((l) => linkedIds.has(l.id))),
  };
}

// Prefill for "Ghi ca vừa xong": companions and place of the last done session with this listener.
export async function recordPrefill(viewer: SessionUser, listenerId: string) {
  const [last] = await db
    .select({ id: sessions.id, locationLabel: sessions.locationLabel })
    .from(sessionListeners)
    .innerJoin(sessions, eq(sessions.id, sessionListeners.sessionId))
    .where(
      and(eq(sessionListeners.listenerId, listenerId), eq(sessions.state, "done"), eq(sessions.areaId, viewer.areaId)),
    )
    .orderBy(desc(sessions.startsAt))
    .limit(1);
  if (!last) return { memberIds: [] as string[], locationLabel: null as string | null };
  const memberIds = (await sessionMemberIds(last.id)).filter((id) => id !== viewer.id);
  return { memberIds, locationLabel: last.locationLabel };
}

// Calendar and "today" board: sessions of the area starting in [from, to). Planned ones for everyone; done and
// cancelled ones only where the viewer may see the listening history (see canSeeSession).
export async function listAreaSessionsBetween(viewer: SessionUser, from: Date, to: Date): Promise<SessionListItem[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.areaId, viewer.areaId), gte(sessions.startsAt, from), lt(sessions.startsAt, to)))
    .orderBy(asc(sessions.startsAt));
  const items = await hydrate(viewer, rows);
  const visible = await historyVisibleListenerIds(
    viewer,
    items.flatMap((s) => s.listeners.map((l) => l.id)),
  );
  return items.filter((s) => s.state === "planned" || s.isMember || s.listeners.some((l) => visible.has(l.id)));
}

async function canSeeSession(viewer: SessionUser, s: SessionListItem) {
  if (s.state === "planned" || s.isMember) return true;
  const visible = await historyVisibleListenerIds(
    viewer,
    s.listeners.map((l) => l.id),
  );
  return visible.size > 0;
}
