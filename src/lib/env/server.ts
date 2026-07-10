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

function readStrictBooleanEnv(value: string | undefined) {
  return readEnv(value) === "true";
}

function readUrlEnv(value: string | undefined) {
  const trimmed = readEnv(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

export function normalizeBaseUrlEnv(value: string | undefined) {
  const trimmed = readEnv(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export const defaultResendFromEmail = "Fortexa <onboarding@resend.dev>";
export const DEFAULT_DIGITALOCEAN_GRADIENT_MODEL = "openai-gpt-oss-20b";
export const DEFAULT_DIGITALOCEAN_GRADIENT_BASE_URL =
  "https://inference.do-ai.run/v1";

const digitalOceanGradientModelAccessKey =
  readEnv(process.env.DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY) ??
  readEnv(process.env.MODEL_ACCESS_KEY);
const digitalOceanGradientLegacyApiKey = readEnv(
  process.env.DIGITALOCEAN_GRADIENT_API_KEY
);
const digitalOceanAccountToken = readEnv(process.env.DIGITALOCEAN_TOKEN);

function buildDigitalOceanCredentialCandidates() {
  const seen = new Set<string>();
  const candidates: Array<{
    source: "model_access_key" | "legacy_api_key" | "account_token";
    value: string;
  }> = [];

  for (const [source, value] of [
    ["model_access_key", digitalOceanGradientModelAccessKey],
    ["legacy_api_key", digitalOceanGradientLegacyApiKey],
    ["account_token", digitalOceanAccountToken],
  ] as const) {
    if (value && !seen.has(value)) {
      seen.add(value);
      candidates.push({ source, value });
    }
  }

  return candidates;
}

export const serverEnv = {
  demoMode: readStrictBooleanEnv(process.env.DEMO_MODE),
  nextPublicAppUrl: readUrlEnv(process.env.NEXT_PUBLIC_APP_URL),
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
  digitalOceanGradientModelAccessKey,
  digitalOceanGradientApiKey:
    digitalOceanGradientModelAccessKey ??
    digitalOceanGradientLegacyApiKey ??
    digitalOceanAccountToken,
  digitalOceanToken: digitalOceanAccountToken,
  digitalOceanGradientCredentialCandidates: buildDigitalOceanCredentialCandidates(),
  digitalOceanGradientModel:
    readEnv(process.env.DIGITALOCEAN_GRADIENT_MODEL) ??
    DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
  digitalOceanGradientBaseUrl:
    normalizeBaseUrlEnv(process.env.DIGITALOCEAN_GRADIENT_BASE_URL) ??
    DEFAULT_DIGITALOCEAN_GRADIENT_BASE_URL,
  digitalOceanGradientTimeoutMs:
    readPositiveIntEnv(process.env.DIGITALOCEAN_GRADIENT_TIMEOUT_MS) ?? 60_000,
  fortexaAiDailyRequestLimit:
    readPositiveIntEnv(process.env.FORTEXA_AI_DAILY_REQUEST_LIMIT) ?? 30,
  fortexaAiAutoImportCveLimit:
    readPositiveIntEnv(process.env.FORTEXA_AI_AUTO_IMPORT_CVE_LIMIT) ?? 5,
  fortexaAiAutoImportPlaybookLimit:
    readPositiveIntEnv(process.env.FORTEXA_AI_AUTO_IMPORT_PLAYBOOK_LIMIT) ?? 3,
  fortexaReportsBucket:
    readEnv(process.env.FORTEXA_REPORTS_BUCKET) ?? "fortexa-reports",
  fortexaScanImportsBucket:
    readEnv(process.env.FORTEXA_SCAN_IMPORTS_BUCKET) ??
    "fortexa-scan-imports",
  resendFromEmail:
    readEnv(process.env.RESEND_FROM_EMAIL) ??
    readEnv(process.env.FORTEXA_MAIL_FROM) ??
    defaultResendFromEmail,
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

  if (serverEnv.digitalOceanGradientCredentialCandidates.length === 0) {
    missing.push("DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY");
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
