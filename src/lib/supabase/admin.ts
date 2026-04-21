import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

let adminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient() {
  if (
    !serverEnv.nextPublicSupabaseUrl ||
    !serverEnv.supabaseServiceRoleKey
  ) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(
      serverEnv.nextPublicSupabaseUrl,
      serverEnv.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return adminClient;
}
