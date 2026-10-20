import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (cookie present). The real session check happens in requireUser() against the database.
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response =
    PUBLIC_PATHS.includes(pathname) || request.cookies.has("sid")
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  // Design doc, Security: pages and RSC payloads may carry listener data; no browser or proxy may store them.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|ico|webmanifest)$).*)"],
};
