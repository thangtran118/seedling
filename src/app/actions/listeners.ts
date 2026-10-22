"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/access/current-user";
import {
  addLink,
  createListener,
  findSimilarListeners,
  removeLink,
  setLessonsReached,
  setManualStatus,
  updateListener,
} from "@/lib/access/listeners";
import { guard, type ActionError } from "./guard";

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
  manualStatus: z.enum(["moi_quen", "goi_mo"]).optional(),
  private: z.object({
    phone: optionalText,
    hometown: optionalText,
    facebook: optionalText,
    zalo: optionalText,
    telegram: optionalText,
    notes: optionalText,
  }),
  confirmNew: z.boolean().optional(),
});

export type ListenerFormInput = z.input<typeof listenerSchema>;
export type ListenerFormResult =
  ActionError | { ok: false; similar: { id: string; name: string; birthYear: number | null }[] };

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
  if (typeof result !== "string") return result;
  redirect(`/nguoi-nghe/${result}`);
}

export async function updateListenerAction(listenerId: string, input: ListenerFormInput): Promise<ListenerFormResult> {
  const user = await requireUser();
  const data = parse(input);
  if (!data) return { ok: false, error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => updateListener(user, listenerId, data));
  if (result) return result;
  redirect(`/nguoi-nghe/${listenerId}`);
}

export type SimpleState = { error?: string } | undefined;

const statusSchema = z.object({
  listenerId: z.string().uuid(),
  status: z.enum(["moi_quen", "goi_mo", "baptem", "tu_choi"]),
});

export async function setStatusAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => setManualStatus(user, parsed.data.listenerId, parsed.data.status));
  if (result) return { error: result.error };
  refresh();
  return {};
}

const lessonsSchema = z.object({
  listenerId: z.string().uuid(),
  lesson: z.coerce.number().int().min(0).max(7),
});

export async function setLessonsAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = lessonsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => setLessonsReached(user, parsed.data.listenerId, parsed.data.lesson));
  if (result) return { error: result.error };
  refresh();
  return {};
}

const linkSchema = z.object({ listenerId: z.string().uuid(), userId: z.string().uuid() });

export async function addLinkAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Chọn một người." };
  const result = await guard(() => addLink(user, parsed.data.listenerId, parsed.data.userId));
  if (result) return { error: result.error };
  refresh();
  return {};
}

export async function removeLinkAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => removeLink(user, parsed.data.listenerId, parsed.data.userId));
  if (result) return { error: result.error };
  refresh();
  return {};
}
