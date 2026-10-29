CREATE TABLE "private"."listener_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listener_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ADD CONSTRAINT "listener_notes_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ADD CONSTRAINT "listener_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listener_notes_listener_idx" ON "private"."listener_notes" USING btree ("listener_id","created_at");--> statement-breakpoint
-- The one profile note per listener becomes its first note, written by whoever created the listener.
INSERT INTO "private"."listener_notes" ("listener_id", "author_id", "body", "created_at")
SELECT l."id", l."created_by", btrim(p."notes"), l."created_at"
FROM "private"."listener_private" p JOIN "public"."listeners" l ON l."id" = p."listener_id"
WHERE btrim(coalesce(p."notes", '')) <> '';--> statement-breakpoint
-- A visit session's note becomes a note on each of its listeners, by the session's creator, dated to the session.
-- Outreach sessions keep theirs (no listener to put it on).
INSERT INTO "private"."listener_notes" ("listener_id", "author_id", "body", "created_at")
SELECT sl."listener_id", s."created_by", btrim(sp."summary"), s."starts_at"
FROM "private"."session_private" sp
JOIN "public"."sessions" s ON s."id" = sp."session_id"
JOIN "public"."session_listeners" sl ON sl."session_id" = s."id"
WHERE s."kind" = 'visit' AND btrim(coalesce(sp."summary", '')) <> '';--> statement-breakpoint
UPDATE "private"."session_private" sp SET "summary" = NULL
FROM "public"."sessions" s
WHERE s."id" = sp."session_id" AND s."kind" = 'visit';--> statement-breakpoint
ALTER TABLE "private"."listener_private" DROP COLUMN "notes";