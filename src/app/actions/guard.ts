import "server-only";
import * as z from "zod";
import { AccessError } from "@/lib/access/errors";

// Database ids are Postgres integer identity columns. Coerces, so it also reads FormData strings.
export const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export type ActionError = { ok: false; error: string };

// Turns access-layer errors into a message for the form. Anything else (including redirect()) propagates.
export async function guard<T>(fn: () => Promise<T>): Promise<T | ActionError> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, error: err.message };
    throw err;
  }
}

export const isActionError = (v: unknown): v is ActionError =>
  typeof v === "object" && v !== null && (v as ActionError).ok === false && "error" in v;
