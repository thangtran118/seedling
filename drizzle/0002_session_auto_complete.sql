-- Results are no longer recorded per session: keep each listener's highest recorded mảnh on the listener, and
-- turn "done" sessions back into plain sessions (they count as completed once their start + 2 hours has passed).
UPDATE "listeners" SET "lessons_reached" = GREATEST("listeners"."lessons_reached", l."latest")
FROM (
	SELECT sl."listener_id", MAX(sl."lesson") AS "latest"
	FROM "session_lessons" sl
	JOIN "sessions" s ON s."id" = sl."session_id"
	WHERE s."state" = 'done'
	GROUP BY sl."listener_id"
) l
WHERE l."listener_id" = "listeners"."id";--> statement-breakpoint
UPDATE "sessions" SET "state" = 'planned' WHERE "state" = 'done';--> statement-breakpoint
DROP TABLE "session_lessons" CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."session_state";--> statement-breakpoint
CREATE TYPE "public"."session_state" AS ENUM('planned', 'cancelled');--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "state" SET DATA TYPE "public"."session_state" USING "state"::"public"."session_state";
