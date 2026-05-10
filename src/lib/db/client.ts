import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/env";

import * as schema from "./schema";

// Single shared Postgres pool + Drizzle client. Imported by both
// `src/lib/auth.ts` (Better Auth's adapter) and `src/app/cont/actions.ts`
// (raw queries for the authorized-clients list and revoke flow). One pool
// per process keeps Neon's pooler from seeing duplicate connections from
// the same Vercel function instance.
//
// `max: 1` because Vercel functions are short-lived and the upstream
// pgbouncer (`-pooler.neon.tech`) handles fan-out. Increasing the cap
// here just stalls the function instance on idle connections.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 1,
});

export const db = drizzle(pool, { schema });
export { schema };
