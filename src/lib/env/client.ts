"use client";

const missingPrefixes = ["__MISSING__", "CHANGE_ME"];

function readEnv(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (missingPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return undefined;
  }

  return trimmed;
}

export const clientEnv = {
  nextPublicSupabaseUrl: readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  nextPublicSupabaseAnonKey: readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  nextPublicSentryDsn: readEnv(process.env.NEXT_PUBLIC_SENTRY_DSN),
} as const;
