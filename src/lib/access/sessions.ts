import "server-only";
import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  listenerLinks,
  listeners,
  piiAccessLog,
  sessionListeners,
  sessionMembers,
  sessionPrivate,
  sessions,
  users,
} from "@/db/schema";
import {
  isOpenPhase,
  nextLesson,
  sessionPhase,
  TIME_ZONE,
  type Route,
  type SessionKind,
  type SessionState,
} from "@/lib/domain";
import type { SessionUser } from "./auth";
import { historyVisibleListenerIds, lessonsHeardFor } from "./listeners";
import { forbiddenError, invalidError, notFoundError } from "./errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------- DTOs ----------

export type SessionListItem = {
  id: number;
  kind: SessionKind;
  startsAt: Date;
  state: SessionState;
  locationLabel: string | null;
  mapUrl: string | null; // Google Maps link to the meeting place, area-visible like the place name
  // nextLesson: the lesson to share next on the listener's route, on upcoming / in-progress sessions only and only
  // where the viewer may see the listener's history (undefined otherwise; null when the route is done).
  // owners: the listener's người đồng hành, so the session list shows whose chiên it is.
  listeners: { id: number; name: string; owners: string[]; nextLesson?: { route: Route; n: number } | null }[];
  members: { id: number; name: string }[];
  isMember: boolean;
  canJoin: boolean; // upcoming or in progress, and the viewer is not in it yet (no member cap)
};

export type SessionDetail = SessionListItem & {
  createdBy: { id: number; name: string };
  canEdit: boolean; // upcoming or in progress, and linked to a listener of the session (outreach: its creator)
  canCancel: boolean; // upcoming or in progress, and the viewer created it
  private: { summary: string | null } | null;
};

export type DuplicateInfo = {
  sessionId: number;
  state: SessionState;
  startsAt: Date;
  createdByName: string;
  listenerName: string;
};

export type WriteResult = { ok: true; id: number } | { ok: false; duplicates: DuplicateInfo[] };

export type CompositionInput = {
  listenerIds: number[];
  memberIds: number[]; // full member list; the planner is added automatically when planning
};

export type DetailsInput = {
  startsAt: Date;
  locationLabel: string | null;
  mapUrl: string | null;
  summary: string | null;
};

// ---------- helpers ----------

const unique = <T>(xs: T[]) => [...new Set(xs)];

function cleanText(value: string | null, maxLen: number, label: string) {
  const t = value?.trim() ?? "";
  if (t.length > maxLen) throw invalidError(`${label} dài quá ${maxLen} ký tự.`);
  return t || null;
}

const MAP_URL_ERROR = "Link Google Maps không hợp lệ. Trên Google Maps bấm Chia sẻ → Sao chép đường liên kết.";

// Only Google Maps links: the whole area sees and opens this link, so it must not point anywhere else.
function cleanMapUrl(value: string | null) {
  const t = cleanText(value, 500, "Link Google Maps");
  if (!t) return null;
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    throw invalidError(MAP_URL_ERROR);
  }
  const host = url.hostname;
  const isMaps =
    host === "maps.app.goo.gl" ||
    (host === "goo.gl" && url.pathname.startsWith("/maps")) ||
    /^maps\.google\.com(\.vn)?$/.test(host) ||
    (/^(www\.)?google\.com(\.vn)?$/.test(host) && url.pathname.startsWith("/maps"));
  if (url.protocol !== "https:" || !isMaps) throw invalidError(MAP_URL_ERROR);
  return url.toString();
}

function validateDetails(input: DetailsInput) {
  if (Number.isNaN(input.startsAt.getTime())) throw invalidError("Thời gian không hợp lệ.");
  return {
    startsAt: input.startsAt,
    locationLabel: cleanText(input.locationLabel, 80, "Nơi gặp"),
    mapUrl: cleanMapUrl(input.mapUrl),
    summary: cleanText(input.summary, 2000, "Ghi chú"),
  };
}

async function validateComposition(viewer: SessionUser, kind: SessionKind, input: CompositionInput) {
  const listenerIds = unique(input.listenerIds);
  const memberIds = unique(input.memberIds);
  // Only the floor is checked: how many people go is up to the team. Outreach goes to meet new people: no listener.
  if (kind === "visit" && listenerIds.length < 1) throw invalidError("Chọn ít nhất một chiên.");
  if (kind === "outreach" && listenerIds.length > 0) throw invalidError("Ca đi tiếp xúc không chọn chiên.");
  if (memberIds.length < 1) throw invalidError("Cần ít nhất một người trudo.");

  if (listenerIds.length) {
    const listenerRows = await db
      .select({ id: listeners.id })
      .from(listeners)
      .where(and(inArray(listeners.id, listenerIds), eq(listeners.areaId, viewer.areaId)));
    if (listenerRows.length !== listenerIds.length) throw invalidError("Chiên không hợp lệ.");
  }

  const memberRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, memberIds), eq(users.areaId, viewer.areaId), eq(users.active, true)));
  if (memberRows.length !== memberIds.length) throw invalidError("Người trudo không hợp lệ.");
  return { listenerIds, memberIds };
}

// Same calendar day in Vietnam time, same listener, not cancelled.
async function findSameDay(
  listenerIds: number[],
  startsAt: Date,
  opts: { excludeSessionId?: number; states: SessionState[] },
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

async function writeComposition(tx: Tx, sessionId: number, c: CompositionInput) {
  await tx.delete(sessionListeners).where(eq(sessionListeners.sessionId, sessionId));
  await tx.delete(sessionMembers).where(eq(sessionMembers.sessionId, sessionId));
  if (c.listenerIds.length) {
    await tx.insert(sessionListeners).values(c.listenerIds.map((listenerId) => ({ sessionId, listenerId })));
  }
  await tx.insert(sessionMembers).values(c.memberIds.map((userId) => ({ sessionId, userId })));
}

async function writePrivate(tx: Tx, sessionId: number, p: { summary: string | null }) {
  await tx
    .insert(sessionPrivate)
    .values({ sessionId, ...p })
    .onConflictDoUpdate({ target: sessionPrivate.sessionId, set: p });
}

async function loadSession(viewer: SessionUser, sessionId: number) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy ca.");
  return row;
}

// Completed (start + 2 hours passed) and cancelled sessions are history: nobody joins, edits or cancels them.
const isOpen = (row: { state: SessionState; startsAt: Date }) => isOpenPhase(sessionPhase(row.state, row.startsAt));

async function sessionListenerIds(sessionId: number) {
  const rows = await db
    .select({ id: sessionListeners.listenerId })
    .from(sessionListeners)
    .where(eq(sessionListeners.sessionId, sessionId));
  return rows.map((r) => r.id);
}

async function sessionMemberIds(sessionId: number) {
  const rows = await db
    .select({ id: sessionMembers.userId })
    .from(sessionMembers)
    .where(eq(sessionMembers.sessionId, sessionId));
  return rows.map((r) => r.id);
}

async function linkedCount(userId: number, listenerIds: number[]) {
  if (listenerIds.length === 0) return 0;
  const rows = await db
    .select({ id: listenerLinks.listenerId })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.userId, userId), inArray(listenerLinks.listenerId, listenerIds)));
  return rows.length;
}

// Planning ("đặt lịch trudo") needs a link to every listener in the session.
async function requireLinkedToAll(viewer: SessionUser, listenerIds: number[]) {
  if ((await linkedCount(viewer.id, listenerIds)) !== listenerIds.length) {
    throw forbiddenError("Chỉ người đồng hành với tất cả chiên trong ca mới được đặt lịch.");
  }
}

// Design decision: edit only by users linked to a listener of the session (outreach: only its creator), and only
// while it is still open.
async function requireEditable(viewer: SessionUser, sessionId: number) {
  const row = await loadSession(viewer, sessionId);
  if (!isOpen(row)) throw invalidError("Ca đã hoàn thành hoặc đã hủy, không sửa được nữa.");
  if (row.kind === "outreach") {
    if (row.createdBy !== viewer.id) throw forbiddenError("Chỉ người tạo ca mới được sửa ca đi tiếp xúc.");
    return row;
  }
  if ((await linkedCount(viewer.id, await sessionListenerIds(sessionId))) === 0) {
    throw forbiddenError("Chỉ người đồng hành với chiên trong ca mới được sửa ca này.");
  }
  return row;
}

// ---------- writes ----------

// "Đặt lịch trudo": a session with the planner as first member; others join from the area calendar. It completes
// on its own 2 hours after it starts unless cancelled. Only users linked to every listener in it may plan (the area
// leader has no special right). An outreach session has no listener, so anyone in the area may plan one.
export async function planSession(
  viewer: SessionUser,
  input: { kind: SessionKind; listenerIds: number[] } & DetailsInput & { confirmDistinct?: boolean },
): Promise<WriteResult> {
  const details = validateDetails(input);
  if (!details.locationLabel) throw invalidError("Cần nhập nơi gặp để người khác biết mà tham gia.");
  const c = await validateComposition(viewer, input.kind, { listenerIds: input.listenerIds, memberIds: [viewer.id] });
  await requireLinkedToAll(viewer, c.listenerIds);
  if (input.kind === "visit" && !input.confirmDistinct) {
    const duplicates = await findSameDay(c.listenerIds, details.startsAt, { states: ["planned"] });
    if (duplicates.length) return { ok: false, duplicates };
  }
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sessions)
      .values({
        areaId: viewer.areaId,
        createdBy: viewer.id,
        kind: input.kind,
        startsAt: details.startsAt,
        locationLabel: details.locationLabel,
        mapUrl: details.mapUrl,
        state: "planned",
      })
      .returning({ id: sessions.id });
    await writeComposition(tx, row.id, c);
    await writePrivate(tx, row.id, { summary: null });
    return row.id;
  });
  return { ok: true, id };
}

// Joining is only possible before a session completes, so nobody can join an old session to read its notes.
export async function joinSession(viewer: SessionUser, sessionId: number) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy ca.");
    if (!isOpen(row)) throw invalidError("Chỉ tham gia được ca chưa bắt đầu hoặc đang diễn ra.");
    const members = await tx.select().from(sessionMembers).where(eq(sessionMembers.sessionId, sessionId));
    if (members.some((m) => m.userId === viewer.id)) return;
    await tx.insert(sessionMembers).values({ sessionId, userId: viewer.id });
  });
}

export async function leaveSession(viewer: SessionUser, sessionId: number) {
  const row = await loadSession(viewer, sessionId);
  if (!isOpen(row)) throw invalidError("Chỉ rời được ca chưa bắt đầu hoặc đang diễn ra.");
  const members = await sessionMemberIds(sessionId);
  if (!members.includes(viewer.id)) return;
  if (members.length <= 1) throw invalidError("Bạn là người duy nhất trong ca. Hãy hủy ca thay vì rời.");
  await db
    .delete(sessionMembers)
    .where(and(eq(sessionMembers.sessionId, sessionId), eq(sessionMembers.userId, viewer.id)));
}

// Edit date, place and people while the session is still open.
export async function updateSession(
  viewer: SessionUser,
  sessionId: number,
  input: Pick<CompositionInput, "memberIds"> & DetailsInput,
) {
  const row = await requireEditable(viewer, sessionId);
  const details = validateDetails(input);
  const c = await validateComposition(viewer, row.kind, { ...input, listenerIds: await sessionListenerIds(sessionId) });
  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({ startsAt: details.startsAt, locationLabel: details.locationLabel, mapUrl: details.mapUrl })
      .where(eq(sessions.id, sessionId));
    await writeComposition(tx, sessionId, c);
    // Only outreach keeps a note on the session; notes about a listener live on the listener (listener_notes).
    await writePrivate(tx, sessionId, { summary: row.kind === "outreach" ? details.summary : null });
  });
}

// Only the person who created the session cancels it, before it completes. There is no delete: cancelling keeps
// every row and records who cancelled, so the session stays in the listening history as "Đã hủy".
export async function cancelSession(viewer: SessionUser, sessionId: number) {
  const row = await loadSession(viewer, sessionId);
  if (row.state === "cancelled") return;
  if (row.createdBy !== viewer.id) throw forbiddenError("Chỉ người tạo ca mới được hủy ca.");
  if (!isOpen(row)) throw invalidError("Ca đã hoàn thành, không hủy được nữa.");
  await db
    .update(sessions)
    .set({ state: "cancelled", cancelledBy: viewer.id, cancelledAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

// ---------- reads ----------

async function hydrate(viewer: SessionUser, rows: (typeof sessions.$inferSelect)[]): Promise<SessionListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [ls, ms, owners] = await Promise.all([
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
    db
      .select({ listenerId: listenerLinks.listenerId, name: users.name })
      .from(listenerLinks)
      .innerJoin(users, eq(users.id, listenerLinks.userId))
      .innerJoin(sessionListeners, eq(sessionListeners.listenerId, listenerLinks.listenerId))
      .where(inArray(sessionListeners.sessionId, ids))
      .orderBy(asc(listenerLinks.createdAt)),
  ]);
  const ownersOf = (listenerId: number) => [
    ...new Set(owners.filter((o) => o.listenerId === listenerId).map((o) => o.name)),
  ];
  const openIds = new Set(rows.filter(isOpen).map((r) => r.id));
  const progressIds = [...new Set(ls.filter((l) => openIds.has(l.sessionId)).map((l) => l.id))];
  const visible = await historyVisibleListenerIds(viewer, progressIds);
  const heard = await lessonsHeardFor([...visible]);
  const nextOn = (p: { route: Route; heard: number[] } | undefined) => {
    const n = p ? nextLesson(p.heard, p.route) : null;
    return p && n !== null ? { route: p.route, n } : null;
  };
  return rows.map((r) => {
    const members = ms.filter((m) => m.sessionId === r.id).map(({ id, name }) => ({ id, name }));
    const isMember = members.some((m) => m.id === viewer.id);
    return {
      id: r.id,
      kind: r.kind,
      startsAt: r.startsAt,
      state: r.state,
      locationLabel: r.locationLabel,
      mapUrl: r.mapUrl,
      listeners: ls
        .filter((l) => l.sessionId === r.id)
        .map(({ id, name }) =>
          openIds.has(r.id) && visible.has(id)
            ? { id, name, owners: ownersOf(id), nextLesson: nextOn(heard.get(id)) }
            : { id, name, owners: ownersOf(id) },
        ),
      members,
      isMember,
      canJoin: openIds.has(r.id) && !isMember,
    };
  });
}

export async function getSessionDetail(viewer: SessionUser, sessionId: number): Promise<SessionDetail> {
  const row = await loadSession(viewer, sessionId);
  const [item] = await hydrate(viewer, [row]);
  const listenerIds = item.listeners.map((l) => l.id);
  // Open sessions are public in the area so people can join; completed and cancelled ones are listening history.
  if (!(await canSeeSession(viewer, item))) throw notFoundError("Không tìm thấy ca.");
  const [creator] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, row.createdBy));
  const linked = (await linkedCount(viewer.id, listenerIds)) > 0;
  const outreach = row.kind === "outreach";
  // Matrix: linked users and the area leader always; unlinked members only when they are in the session. Outreach
  // notes are about no listener: the whole area reads them.
  const canSeePrivate = outreach || linked || item.isMember || viewer.role === "area_leader";
  let priv: SessionDetail["private"] = null;
  if (canSeePrivate) {
    const [p] = await db.select().from(sessionPrivate).where(eq(sessionPrivate.sessionId, sessionId));
    priv = { summary: p?.summary ?? null };
    await db.insert(piiAccessLog).values({ viewerId: viewer.id, sessionId, reason: "view_session_private" });
  }
  return {
    ...item,
    createdBy: creator,
    canEdit: (outreach ? row.createdBy === viewer.id : linked) && isOpen(row),
    canCancel: row.createdBy === viewer.id && isOpen(row),
    private: priv,
  };
}

// Area calendar: not-cancelled sessions from the start of today (Vietnam time).
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

// Calendar and "today" board: sessions of the area starting in [from, to). Open ones for everyone; completed and
// cancelled ones only where the viewer may see the listening history (see canSeeSession); outreach ones for everyone.
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
  return items.filter(
    (s) => s.kind === "outreach" || isOpen(s) || s.isMember || s.listeners.some((l) => visible.has(l.id)),
  );
}

async function canSeeSession(viewer: SessionUser, s: SessionListItem) {
  if (s.kind === "outreach" || isOpen(s) || s.isMember) return true;
  const visible = await historyVisibleListenerIds(
    viewer,
    s.listeners.map((l) => l.id),
  );
  return visible.size > 0;
}
