"use server";

import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/access/current-user";
import {
  cancelSession,
  giveUpSharing,
  joinSession,
  leaveSession,
  planSession,
  takeSharing,
  updateSession,
  type DuplicateInfo,
} from "@/lib/access/sessions";
import { fromLocalInputValue } from "@/lib/domain";
import { guard, idSchema as id, isActionError, type ActionError } from "./guard";

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const payloadSchema = z.object({
  kind: z.enum(["visit", "outreach"]).default("visit"),
  listenerIds: z.array(id).default([]),
  memberIds: z.array(id).default([]),
  startsAt: z.string(),
  locationLabel: text,
  mapUrl: text,
  summary: text,
  iShare: z.boolean().optional(),
  confirmDistinct: z.boolean().optional(),
});

export type SessionPayload = z.input<typeof payloadSchema>;
export type SessionFormResult = ActionError | { ok: false; duplicates: DuplicateInfo[] };

function parse(input: unknown) {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return null;
  const startsAt = fromLocalInputValue(parsed.data.startsAt);
  if (!startsAt) return null;
  return { ...parsed.data, startsAt };
}

const BAD = { ok: false, error: "Dữ liệu không hợp lệ." } as const;

export async function planSessionAction(input: SessionPayload): Promise<SessionFormResult> {
  const user = await requireUser();
  const data = parse(input);
  if (!data) return BAD;
  const result = await guard(() => planSession(user, data));
  if (isActionError(result) || !result.ok) return result;
  redirect(`/ca/${result.id}?da-luu=1`, RedirectType.replace); // the form page drops out of history: "back" skips it
}

export async function updateSessionAction(sessionId: number, input: SessionPayload): Promise<SessionFormResult> {
  const user = await requireUser();
  const data = parse(input);
  if (!data || !id.safeParse(sessionId).success) return BAD;
  const result = await guard(() => updateSession(user, sessionId, data));
  if (result) return result;
  redirect(`/ca/${sessionId}?da-luu=1`, RedirectType.replace);
}

export type SimpleState = { error?: string } | undefined;

function sessionIdFrom(formData: FormData) {
  const parsed = id.safeParse(formData.get("sessionId"));
  return parsed.success ? parsed.data : null;
}

async function simple(
  formData: FormData,
  fn: (userId: Awaited<ReturnType<typeof requireUser>>, sid: number) => Promise<void>,
) {
  const user = await requireUser();
  const sid = sessionIdFrom(formData);
  if (!sid) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => fn(user, sid));
  if (result) return { error: result.error };
  refresh();
  return {};
}

export async function joinSessionAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  return simple(formData, joinSession);
}

export async function leaveSessionAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  return simple(formData, leaveSession);
}

export async function cancelSessionAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  return simple(formData, cancelSession);
}

export async function takeSharingAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  return simple(formData, takeSharing);
}

export async function giveUpSharingAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  return simple(formData, giveUpSharing);
}
