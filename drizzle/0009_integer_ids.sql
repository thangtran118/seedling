-- Every id becomes an integer identity. Existing rows are numbered per table in creation order, and every
-- reference is rewritten through the same mapping (uuids are unique across tables, so one map serves all).
CREATE TABLE "_id_map" ("old" uuid PRIMARY KEY, "new" integer NOT NULL);--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "created_at", "id") FROM "areas";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "created_at", "id") FROM "private"."listener_notes";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "created_at", "id") FROM "listeners";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "at", "id") FROM "login_attempts";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "at", "id") FROM "pii_access_log";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "created_at", "id") FROM "sessions";--> statement-breakpoint
INSERT INTO "_id_map" SELECT "id", row_number() OVER (ORDER BY "created_at", "id") FROM "users";--> statement-breakpoint
CREATE FUNCTION "_new_id"(uuid) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT "new" FROM "_id_map" WHERE "old" = $1 $$;--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "listener_links" DROP CONSTRAINT "listener_links_listener_id_listeners_id_fk";--> statement-breakpoint
ALTER TABLE "listener_links" DROP CONSTRAINT "listener_links_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "listener_links" DROP CONSTRAINT "listener_links_added_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "private"."listener_notes" DROP CONSTRAINT "listener_notes_listener_id_listeners_id_fk";--> statement-breakpoint
ALTER TABLE "private"."listener_notes" DROP CONSTRAINT "listener_notes_author_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "private"."listener_private" DROP CONSTRAINT "listener_private_listener_id_listeners_id_fk";--> statement-breakpoint
ALTER TABLE "listeners" DROP CONSTRAINT "listeners_area_id_areas_id_fk";--> statement-breakpoint
ALTER TABLE "listeners" DROP CONSTRAINT "listeners_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "pii_access_log" DROP CONSTRAINT "pii_access_log_viewer_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pii_access_log" DROP CONSTRAINT "pii_access_log_listener_id_listeners_id_fk";--> statement-breakpoint
ALTER TABLE "pii_access_log" DROP CONSTRAINT "pii_access_log_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "pii_access_log" DROP CONSTRAINT "pii_access_log_target_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "session_listeners" DROP CONSTRAINT "session_listeners_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "session_listeners" DROP CONSTRAINT "session_listeners_listener_id_listeners_id_fk";--> statement-breakpoint
ALTER TABLE "session_members" DROP CONSTRAINT "session_members_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "session_members" DROP CONSTRAINT "session_members_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "private"."session_private" DROP CONSTRAINT "session_private_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_area_id_areas_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_cancelled_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_area_id_areas_id_fk";--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "user_id" SET DATA TYPE integer USING "_new_id"("user_id");--> statement-breakpoint
ALTER TABLE "listener_links" ALTER COLUMN "listener_id" SET DATA TYPE integer USING "_new_id"("listener_id");--> statement-breakpoint
ALTER TABLE "listener_links" ALTER COLUMN "user_id" SET DATA TYPE integer USING "_new_id"("user_id");--> statement-breakpoint
ALTER TABLE "listener_links" ALTER COLUMN "added_by" SET DATA TYPE integer USING "_new_id"("added_by");--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ALTER COLUMN "listener_id" SET DATA TYPE integer USING "_new_id"("listener_id");--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ALTER COLUMN "author_id" SET DATA TYPE integer USING "_new_id"("author_id");--> statement-breakpoint
ALTER TABLE "private"."listener_private" ALTER COLUMN "listener_id" SET DATA TYPE integer USING "_new_id"("listener_id");--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "area_id" SET DATA TYPE integer USING "_new_id"("area_id");--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "created_by" SET DATA TYPE integer USING "_new_id"("created_by");--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "viewer_id" SET DATA TYPE integer USING "_new_id"("viewer_id");--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "listener_id" SET DATA TYPE integer USING "_new_id"("listener_id");--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "session_id" SET DATA TYPE integer USING "_new_id"("session_id");--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "target_user_id" SET DATA TYPE integer USING "_new_id"("target_user_id");--> statement-breakpoint
ALTER TABLE "session_listeners" ALTER COLUMN "session_id" SET DATA TYPE integer USING "_new_id"("session_id");--> statement-breakpoint
ALTER TABLE "session_listeners" ALTER COLUMN "listener_id" SET DATA TYPE integer USING "_new_id"("listener_id");--> statement-breakpoint
ALTER TABLE "session_members" ALTER COLUMN "session_id" SET DATA TYPE integer USING "_new_id"("session_id");--> statement-breakpoint
ALTER TABLE "session_members" ALTER COLUMN "user_id" SET DATA TYPE integer USING "_new_id"("user_id");--> statement-breakpoint
ALTER TABLE "private"."session_private" ALTER COLUMN "session_id" SET DATA TYPE integer USING "_new_id"("session_id");--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "area_id" SET DATA TYPE integer USING "_new_id"("area_id");--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_by" SET DATA TYPE integer USING "_new_id"("created_by");--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "cancelled_by" SET DATA TYPE integer USING "_new_id"("cancelled_by");--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE integer USING "_new_id"("id");--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "area_id" SET DATA TYPE integer USING "_new_id"("area_id");--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_by" SET DATA TYPE integer USING "_new_id"("created_by");--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "areas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"areas_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "areas";--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "private"."listener_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"private"."listener_notes_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "private"."listener_notes";--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "listeners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"listeners_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "listeners";--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"login_attempts_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "login_attempts";--> statement-breakpoint
ALTER TABLE "pii_access_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "pii_access_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"pii_access_log_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "pii_access_log";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"sessions_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "sessions";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"users_id_seq"', coalesce(max("id"), 0) + 1, false) FROM "users";--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener_links" ADD CONSTRAINT "listener_links_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener_links" ADD CONSTRAINT "listener_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener_links" ADD CONSTRAINT "listener_links_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ADD CONSTRAINT "listener_notes_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."listener_notes" ADD CONSTRAINT "listener_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."listener_private" ADD CONSTRAINT "listener_private_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listeners" ADD CONSTRAINT "listeners_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listeners" ADD CONSTRAINT "listeners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pii_access_log" ADD CONSTRAINT "pii_access_log_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pii_access_log" ADD CONSTRAINT "pii_access_log_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pii_access_log" ADD CONSTRAINT "pii_access_log_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pii_access_log" ADD CONSTRAINT "pii_access_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_listeners" ADD CONSTRAINT "session_listeners_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_listeners" ADD CONSTRAINT "session_listeners_listener_id_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."listeners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_members" ADD CONSTRAINT "session_members_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_members" ADD CONSTRAINT "session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."session_private" ADD CONSTRAINT "session_private_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP FUNCTION "_new_id"(uuid);--> statement-breakpoint
DROP TABLE "_id_map";
