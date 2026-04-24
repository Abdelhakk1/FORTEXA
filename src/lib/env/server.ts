import "server-only";

const missingPrefixes = ["__MISSING", "CHANGE_ME"];

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

function readPositiveIntEnv(value: string | undefined) {
  const trimmed = readEnv(value);

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export const serverEnv = {
  nextPublicSupabaseUrl: readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  nextPublicSupabaseAnonKey: readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  nextPublicSentryDsn: readEnv(process.env.NEXT_PUBLIC_SENTRY_DSN),
  supabaseServiceRoleKey: readEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
  databaseUrl: readEnv(process.env.DATABASE_URL),
  resendApiKey: readEnv(process.env.RESEND_API_KEY),
  sentryDsn: readEnv(process.env.SENTRY_DSN),
  sentryAuthToken: readEnv(process.env.SENTRY_AUTH_TOKEN),
  sentryOrg: readEnv(process.env.SENTRY_ORG),
  sentryProject: readEnv(process.env.SENTRY_PROJECT),
  inngestEventKey: readEnv(process.env.INNGEST_EVENT_KEY),
  inngestSigningKey: readEnv(process.env.INNGEST_SIGNING_KEY),
  inngestAppId: readEnv(process.env.INNGEST_APP_ID) ?? "fortexa",
  openrouterApiKey: readEnv(process.env.OPENROUTER_API_KEY),
  openrouterModel:
    readEnv(process.env.OPENROUTER_MODEL) ??
    "inclusionai/ling-2.6-flash:free",
  openrouterFallbackModel: readEnv(process.env.OPENROUTER_FALLBACK_MODEL),
  openrouterBaseUrl:
    readEnv(process.env.OPENROUTER_BASE_URL) ??
    "https://openrouter.ai/api/v1",
  openrouterTimeoutMs:
    readPositiveIntEnv(process.env.OPENROUTER_TIMEOUT_MS) ?? 30_000,
  fortexaReportsBucket:
    readEnv(process.env.FORTEXA_REPORTS_BUCKET) ?? "fortexa-reports",
  fortexaScanImportsBucket:
    readEnv(process.env.FORTEXA_SCAN_IMPORTS_BUCKET) ??
    "fortexa-scan-imports",
  fortexaMailFrom: readEnv(process.env.FORTEXA_MAIL_FROM),
} as const;

export function getMissingEnvVars() {
  const missing: string[] = [];

  if (!serverEnv.nextPublicSupabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serverEnv.nextPublicSupabaseAnonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!serverEnv.supabaseServiceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!serverEnv.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (!serverEnv.resendApiKey) {
    missing.push("RESEND_API_KEY");
  }

  if (!serverEnv.sentryDsn) {
    missing.push("SENTRY_DSN");
  }

  if (!serverEnv.inngestEventKey) {
    missing.push("INNGEST_EVENT_KEY");
  }

  if (!serverEnv.inngestSigningKey) {
    missing.push("INNGEST_SIGNING_KEY");
  }

  if (!serverEnv.openrouterApiKey) {
    missing.push("OPENROUTER_API_KEY");
  }

  return missing;
}

export function hasSupabaseBrowserEnv() {
  return Boolean(
    serverEnv.nextPublicSupabaseUrl && serverEnv.nextPublicSupabaseAnonKey
  );
}

export function hasDatabaseEnv() {
  return Boolean(serverEnv.databaseUrl);
}

export function hasSupabaseAdminEnv() {
  return Boolean(
    serverEnv.nextPublicSupabaseUrl && serverEnv.supabaseServiceRoleKey
  );
}
