import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";

export const SESSION_COOKIE = "sid";

// Deliberately not wrapped in "use cache": a locked account or revoked session must take effect on the next request.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Everything after an auth check is per-request (and uses the current time), never prerendered.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
});

type Gate = "full" | "password-change";

// "full": logged in and password changed. "password-change" is used by the password page itself.
export async function requireUser(gate: Gate = "full"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (gate === "password-change") return user;
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}
