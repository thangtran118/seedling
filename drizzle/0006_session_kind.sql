CREATE TYPE "public"."session_kind" AS ENUM('visit', 'outreach');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "kind" "session_kind" DEFAULT 'visit' NOT NULL;