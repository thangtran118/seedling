import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { listenerLinks, listenerNotes, listeners, piiAccessLog, users } from "@/db/schema";
import type { SessionUser } from "./auth";
import { forbiddenError, invalidError } from "./errors";
import { canAddNote, requireInRegion } from "./scope";

// Notes are read like the listening history, by the whole region; callers pass listeners of the viewer's region and
// log that read. Only a người đồng hành adds one.
export type ListenerNote = {
  id: number;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  author: string;
  canEdit: boolean; // the viewer wrote it
};

export const NOTE_MAX = 2000;

// Newest first, per listener.
export async function notesFor(viewer: SessionUser, listenerIds: number[]): Promise<Map<number, ListenerNote[]>> {
  const result = new Map<number, ListenerNote[]>(listenerIds.map((id) => [id, []]));
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
export async function addNote(viewer: SessionUser, listenerId: number, input: { body: string }) {
  const body = cleanNoteBody(input.body);
  const [listener] = await db
    .select({ areaId: listeners.areaId, regionId: listeners.regionId })
    .from(listeners)
    .where(eq(listeners.id, listenerId));
  requireInRegion(viewer, listener, "Không tìm thấy chiên.");
  const [link] = await db
    .select({ userId: listenerLinks.userId })
    .from(listenerLinks)
    .where(and(eq(listenerLinks.listenerId, listenerId), eq(listenerLinks.userId, viewer.id)));
  if (!canAddNote(viewer, listener, Boolean(link)))
    throw forbiddenError("Chỉ người đồng hành của chiên này mới được thêm ghi chú.");
  await db.transaction(async (tx) => {
    await tx.insert(listenerNotes).values({ listenerId, authorId: viewer.id, body });
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_added" });
  });
}

// Only whoever wrote a note edits or deletes it.
async function loadOwnNote(viewer: SessionUser, noteId: number) {
  const [row] = await db
    .select({ listenerId: listenerNotes.listenerId, authorId: listenerNotes.authorId, regionId: listeners.regionId })
    .from(listenerNotes)
    .innerJoin(listeners, eq(listeners.id, listenerNotes.listenerId))
    .where(eq(listenerNotes.id, noteId));
  requireInRegion(viewer, row, "Không tìm thấy ghi chú.");
  if (row.authorId !== viewer.id) throw forbiddenError("Chỉ người viết ghi chú mới được sửa hoặc xóa.");
  return row;
}

export async function updateNote(viewer: SessionUser, noteId: number, body: string) {
  const clean = cleanNoteBody(body);
  const { listenerId } = await loadOwnNote(viewer, noteId);
  await db.transaction(async (tx) => {
    await tx.update(listenerNotes).set({ body: clean, updatedAt: new Date() }).where(eq(listenerNotes.id, noteId));
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_edited" });
  });
}

export async function deleteNote(viewer: SessionUser, noteId: number) {
  const { listenerId } = await loadOwnNote(viewer, noteId);
  await db.transaction(async (tx) => {
    await tx.delete(listenerNotes).where(eq(listenerNotes.id, noteId));
    await tx.insert(piiAccessLog).values({ viewerId: viewer.id, listenerId, reason: "note_deleted" });
  });
}
