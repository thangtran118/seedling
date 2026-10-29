DROP INDEX "one_leader_per_area";--> statement-breakpoint
CREATE UNIQUE INDEX "one_leader_per_area" ON "users" USING btree ("area_id") WHERE "users"."role" = 'area_leader' and "users"."active";