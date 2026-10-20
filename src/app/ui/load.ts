import "server-only";
import { notFound } from "next/navigation";
import { AccessError } from "@/lib/access/errors";

// Pages: a record the viewer may not see is indistinguishable from one that does not exist.
export async function loadOr404<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof AccessError && (err.code === "not_found" || err.code === "forbidden")) notFound();
    throw err;
  }
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
