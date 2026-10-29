-- Địa vực: one region holding every existing area; users, listeners and sessions carry region_id next to area_id.
-- drizzle-kit migrate runs all pending migrations in ONE transaction, and Postgres cannot use an enum value in the
-- transaction that added it: nothing below (nor any later migration shipped with this one) may name 'region_leader'.
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "regions" ("name") VALUES ('Địa vực');--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "region_id" integer;--> statement-breakpoint
UPDATE "areas" SET "region_id" = (SELECT min("id") FROM "regions");--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "region_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_id_region" UNIQUE("id","region_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "region_id" integer;--> statement-breakpoint
UPDATE "users" u SET "region_id" = a."region_id" FROM "areas" a WHERE a."id" = u."area_id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "region_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_region_fk" FOREIGN KEY ("area_id","region_id") REFERENCES "public"."areas"("id","region_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "listeners" ADD COLUMN "region_id" integer;--> statement-breakpoint
UPDATE "listeners" l SET "region_id" = a."region_id" FROM "areas" a WHERE a."id" = l."area_id";--> statement-breakpoint
ALTER TABLE "listeners" ALTER COLUMN "region_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "listeners" ADD CONSTRAINT "listeners_area_region_fk" FOREIGN KEY ("area_id","region_id") REFERENCES "public"."areas"("id","region_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "region_id" integer;--> statement-breakpoint
UPDATE "sessions" s SET "region_id" = a."region_id" FROM "areas" a WHERE a."id" = s."area_id";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "region_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_area_region_fk" FOREIGN KEY ("area_id","region_id") REFERENCES "public"."areas"("id","region_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
-- One leader per area. Fails if an area already has two leaders: fix the data first, then rerun.
CREATE UNIQUE INDEX "one_leader_per_area" ON "users" USING btree ("area_id") WHERE "users"."role" <> 'member' and "users"."active";--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'region_leader';
