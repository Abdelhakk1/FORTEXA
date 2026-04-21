"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/client";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  if (
    !clientEnv.nextPublicSupabaseUrl ||
    !clientEnv.nextPublicSupabaseAnonKey
  ) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      clientEnv.nextPublicSupabaseUrl,
      clientEnv.nextPublicSupabaseAnonKey
    );
  }

  return browserClient;
}
