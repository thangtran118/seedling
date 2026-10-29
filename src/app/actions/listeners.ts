"use server";

import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/access/current-user";
import {
  addLink,
  createListener,
  findSimilarListeners,
  removeLink,
  setProgress,
  updateListener,
} from "@/lib/access/listeners";
import { addNote, deleteNote, updateNote } from "@/lib/access/notes";
import { MAX_LESSONS, ROUTE_KEYS } from "@/lib/domain";
import { guard, idSchema, type ActionError } from "./guard";

const optionalText = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

const listenerSchema = z.object({
  name: z.string(),
  birthYear: z
    .union([z.number().int(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
  progress: z
    .object({
      route: z.enum(ROUTE_KEYS).default("manh"),
      manualStatus: z.enum(["moi_quen", "goi_mo", "baptem", "tu_choi"]),
      // The per-route bound is checked in the access layer.
      lessons: z.number().int().min(0).max(MAX_LESSONS),
    })
    .optional(),
  private: z.object({
    phone: optionalText,
    hometown: optionalText,
    facebook: optionalText,
    zalo: optionalText,
    telegram: optionalText,
  }),
  note: optionalText, // the first note, on create only
  confirmNew: z.boolean().optional(),
});

export type ListenerFormInput = z.input<typeof listenerSchema>;
export type ListenerFormResult =
  ActionError | { ok: false; similar: { id: number; name: string; birthYear: number | null }[] };

function parse(input: unknown) {
  const parsed = listenerSchema.safeParse(input);
  if (!parsed.success) return null;
  if (parsed.data.birthYear !== null && Number.isNaN(parsed.data.birthYear)) return null;
  return parsed.data;
}

export async function createListenerAction(input: ListenerFormInput): Promise<ListenerFormResult> {
  const user = await requireUser();
  const data = parse(input);
  if (!data) return { ok: false, error: "Dữ liệu không hợp lệ." };
  if (!data.confirmNew) {
    const similar = await findSimilarListeners(user, data.name);
    if (similar.length) return { ok: false, similar };
  }
  const result = await guard(() => createListener(user, data));
  if (typeof result !== "number") return result;
  redirect(`/nguoi-nghe/${result}`, RedirectType.replace); // the form page drops out of history: "back" skips it
}

export async function updateListenerAction(listenerId: number, input: ListenerFormInput): Promise<ListenerFormResult> {
  const user = await requireUser();
  const data = parse(input);
  if (!data) return { ok: false, error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => updateListener(user, listenerId, data));
  if (result) return result;
  redirect(`/nguoi-nghe/${listenerId}`, RedirectType.replace);
}

export type SimpleState = { error?: string } | undefined;

const saveSchema = z.object({
  progress: z
    .object({
      route: z.enum(ROUTE_KEYS),
      expectedRoute: z.enum(ROUTE_KEYS), // the saved route the page was showing
      manualStatus: z.enum(["moi_quen", "goi_mo", "baptem", "tu_choi"]),
      lessons: z.number().int().min(0).max(MAX_LESSONS),
    })
    .optional(),
  addUserIds: z.array(idSchema).max(50).default([]),
});

// The listener page's single "Lưu": route + stage + lesson (when changed) and the người đồng hành picked to add.
export async function saveListenerAction(listenerId: number, input: z.input<typeof saveSchema>): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(listenerId).success) return { error: "Dữ liệu không hợp lệ." };
  const { progress, addUserIds } = parsed.data;
  const result = await guard(async () => {
    if (progress) await setProgress(user, listenerId, progress);
    for (const userId of addUserIds) await addLink(user, listenerId, userId);
  });
  if (result) return { error: result.error };
  refresh();
  return {};
}

const noteSchema = z.object({ body: z.string() });

// Notes save on their own, outside the page's "Lưu thay đổi" bar.
export async function addNoteAction(listenerId: number, input: z.input<typeof noteSchema>): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(listenerId).success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => addNote(user, listenerId, parsed.data));
  if (result) return { error: result.error };
  refresh();
  return {};
}

export async function updateNoteAction(noteId: number, body: string): Promise<SimpleState> {
  const user = await requireUser();
  if (!idSchema.safeParse(noteId).success || typeof body !== "string") return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => updateNote(user, noteId, body));
  if (result) return { error: result.error };
  refresh();
  return {};
}

export async function deleteNoteAction(noteId: number): Promise<SimpleState> {
  const user = await requireUser();
  if (!idSchema.safeParse(noteId).success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => deleteNote(user, noteId));
  if (result) return { error: result.error };
  refresh();
  return {};
}

const linkSchema = z.object({ listenerId: idSchema, userId: idSchema });

export async function removeLinkAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => removeLink(user, parsed.data.listenerId, parsed.data.userId));
  if (result) return { error: result.error };
  refresh();
  return {};
}
