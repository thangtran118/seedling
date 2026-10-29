CREATE TYPE "public"."listening_route" AS ENUM('manh', 'b', 'f');--> statement-breakpoint
ALTER TABLE "listeners" DROP CONSTRAINT "lessons_reached_range";--> statement-breakpoint
ALTER TABLE "listeners" ADD COLUMN "route" "listening_route" DEFAULT 'manh' NOT NULL;--> statement-breakpoint
ALTER TABLE "listeners" ADD CONSTRAINT "lessons_reached_range" CHECK ("listeners"."lessons_reached" >= 0 and "listeners"."lessons_reached" <= case "listeners"."route" when 'b' then 12 when 'f' then 5 else 7 end);--> statement-breakpoint
-- "Đã chia sẻ lẽ thật" now counts first_lesson_at (it survives a route change); make sure every listener already
-- past lesson 1 has it. 0003 backfilled these, so this is expected to touch no rows.
UPDATE "listeners" SET "first_lesson_at" = "created_at" WHERE "lessons_reached" > 0 AND "first_lesson_at" IS NULL;
