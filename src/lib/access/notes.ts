import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, listenerNotes, listeners, piiAccessLog, users } from "@/db/schema";
import type { SessionUser } from "./auth";
import { forbiddenError, invalidError, notFoundError } from "./errors";

// Notes are private listener data, read like the listening history: callers pass only listeners whose history the
// viewer may see (linked users, people on a session with the listener, the area leader; historyVisibleListenerIds)
// and log that read.
export type ListenerNote = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  author: string;
  canEdit: boolean; // the viewer wrote it
};

export const NOTE_MAX = 2000;

// Newest first, per listener.
export async function notesFor(viewer: SessionUser, listenerIds: string[]): Promise<Map<string, ListenerNote[]>> {
  const result = new Map<string, ListenerNote[]>(listenerIds.map((id) => [id, []]));
  if (listenerIds.length === 0) return result;
  const rows = await db
    .select({
      id: listenerNotes.id,
      listenerId: listenerNotes.listenerId,
      body: listenerNotes.body,
      createdAt: listenerNotes.createdAt,
      updatedAt: listenerNotes.updatedAt,
      authorId: listenerNotes.authorId,
      author: users.name,
    })
    .from(listenerNotes)
    .innerJoin(users, eq(users.id, listenerNotes.authorId))
    .where(inArray(listenerNotes.listenerId, listenerIds))
    .orderBy(desc(listenerNotes.createdAt));
  for (const r of rows) {
    result.get(r.listenerId)?.push({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: r.author,
      canEdit: r.authorId === viewer.id,
    });
  }
  return result;
}

export function cleanNoteBody(body: string) {
  const t = body.trim();
  if (!t) throw invalidError("Ghi chú đang trống.");
  if (t.length > NOTE_MAX) throw invalidError(`Ghi chú dài quá ${NOTE_MAX} ký tự.`);
  return t;
}

// Any người đồng hành of the listener adds a note, whenever (often after a buổi trudo). Notes are not tied to a
// session.
export async function addNote(viewer: SessionUser, listenerId: string, input: { body: string }) {
  const body = cleanNoteBody(input.body);
  const [listener] = await db.select({ areaId: listeners.areaId }).from(listeners).where(eq(listeners.id, listenerId));
  if (!listener || listener.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy chiên.");
  const [link] = await db
    .select({ userId: listenerLinks.userId })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.listenerId, listenerId), eq(listenerLinks.userId, viewer.id)));
  if (!link) throw forbiddenError("Chỉ người đồng hành của chiên này mới được thêm ghi chú.");
  await db.transaction(async (tx) => {
    await tx.insert(listenerNotes).values({ listenerId, authorId: viewer.id, body });
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_added" });
  });
}

// Only whoever wrote a note edits or deletes it.
async function loadOwnNote(viewer: SessionUser, noteId: string) {
  const [row] = await db
    .select({ listenerId: listenerNotes.listenerId, authorId: listenerNotes.authorId, areaId: listeners.areaId })
    .from(listenerNotes)
    .innerJoin(listeners, eq(listeners.id, listenerNotes.listenerId))
    .where(eq(listenerNotes.id, noteId));
  if (!row || row.areaId !== viewer.areaId) throw notFoundError("Không tìm thấy ghi chú.");
  if (row.authorId !== viewer.id) throw forbiddenError("Chỉ người viết ghi chú mới được sửa hoặc xóa.");
  return row;
}

export async function updateNote(viewer: SessionUser, noteId: string, body: string) {
  const clean = cleanNoteBody(body);
  const { listenerId } = await loadOwnNote(viewer, noteId);
  await db.transaction(async (tx) => {
    await tx.update(listenerNotes).set({ body: clean, updatedAt: new Date() }).where(eq(listenerNotes.id, noteId));
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_edited" });
  });
}

export async function deleteNote(viewer: SessionUser, noteId: string) {
  const { listenerId } = await loadOwnNote(viewer, noteId);
  await db.transaction(async (tx) => {
    await tx.delete(listenerNotes).where(eq(listenerNotes.id, noteId));
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_deleted" });
  });
}
