ALTER TABLE "sessions" ALTER COLUMN "area_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "area_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The region leader belongs to no area, and the sessions they created belong to every area of the region. Only the
-- older enum values are named: this ships in the same transaction as 0011, which added region_leader.
UPDATE "sessions" s SET "area_id" = NULL FROM "users" u WHERE u."id" = s."created_by" AND u."role" NOT IN ('member', 'area_leader');--> statement-breakpoint
UPDATE "users" SET "area_id" = NULL WHERE "role" NOT IN ('member', 'area_leader');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_by_role" CHECK (("users"."area_id" is null) = ("users"."role" not in ('member', 'area_leader')));