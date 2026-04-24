import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { serverEnv } from "@/lib/env/server";

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

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!serverEnv.databaseUrl) {
    return null;
  }

  if (!client) {
    client = postgres(serverEnv.databaseUrl, {
      prepare: false, // Required for Supabase transaction mode pooling
      connect_timeout: 8,
      idle_timeout: 10,
      max: 10,
      connection: {
        idle_in_transaction_session_timeout: 8000,
        statement_timeout: 8000,
      },
    });
  }

  if (!dbInstance) {
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}
