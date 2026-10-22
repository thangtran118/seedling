ALTER TABLE "listeners" ADD COLUMN "first_lesson_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listeners" ADD COLUMN "baptized_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: the real moments were never stored, so use the first / last completed session with the listener,
-- or the day the listener was added.
UPDATE "listeners" SET "first_lesson_at" = COALESCE(
	(SELECT MIN(s."starts_at") FROM "session_listeners" sl JOIN "sessions" s ON s."id" = sl."session_id"
	 WHERE sl."listener_id" = "listeners"."id" AND s."state" = 'planned' AND s."starts_at" <= now() - interval '2 hours'),
	"listeners"."created_at")
WHERE "lessons_reached" > 0;--> statement-breakpoint
UPDATE "listeners" SET "baptized_at" = COALESCE(
	(SELECT MAX(s."starts_at") FROM "session_listeners" sl JOIN "sessions" s ON s."id" = sl."session_id"
	 WHERE sl."listener_id" = "listeners"."id" AND s."state" = 'planned' AND s."starts_at" <= now() - interval '2 hours'),
	"listeners"."created_at")
WHERE "manual_status" = 'baptem';
