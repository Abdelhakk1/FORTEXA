import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database client — Drizzle ORM + postgres.js driver.
 *
 * Uses DATABASE_URL from environment variables.
 * In Supabase, this is:
 *   - Transaction mode: "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
 *   - Session mode: same but port 5432
 *
 * Use transaction mode (port 6543) for serverless (Next.js server actions).
 * Use session mode (port 5432) for long-running connections (Inngest workers).
 */

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false, // Required for Supabase transaction mode pooling
});

export const db = drizzle(client, { schema });
