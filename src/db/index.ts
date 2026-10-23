import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Production uses Neon's pooled URL (PgBouncer, transaction mode): no prepared statements, and few, short-lived
// connections per serverless instance so a sleeping function does not hold them open.
const client = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
export const db = drizzle(client, { schema });
export type Db = typeof db;
export { client as sqlClient };
