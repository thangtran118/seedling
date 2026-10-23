ALTER TABLE "sessions" ALTER COLUMN "location_label" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "map_url" varchar(500);--> statement-breakpoint
ALTER TABLE "private"."session_private" DROP COLUMN "location_detail";