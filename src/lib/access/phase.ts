import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { sessions } from "@/db/schema";
import { SESSION_LIVE_MS } from "@/lib/domain";

// SQL twin of sessionPhase (src/lib/domain.ts): a session completes on its own once SESSION_LIVE_MS has
// passed since its start, unless it was cancelled.
export const completedAt = (now: Date) =>
  and(eq(sessions.state, "planned"), lte(sessions.startsAt, new Date(now.getTime() - SESSION_LIVE_MS)));
