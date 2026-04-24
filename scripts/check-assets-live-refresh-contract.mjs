import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { TextDecoder } from "node:util";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function createEphemeralUser() {
  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `perf.tester+${suffix}@fortexa.local`;
  const password = `Fortexa!${randomBytes(6).toString("hex")}A1`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw error ?? new Error("Failed to create test user");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "administrator")
    .single();

  if (roleError || !role) {
    throw roleError ?? new Error("Administrator role not found");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    full_name: "Fortexa Smoke Tester",
    email,
    role_id: role.id,
    status: "active",
  });

  if (profileError) {
    throw profileError;
  }

  return {
    supabase,
    userId: data.user.id,
    email,
    password,
  };
}

async function createCookieHeader(email, password) {
  const cookies = [];
  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookies;
        },
        setAll(nextCookies) {
          for (const nextCookie of nextCookies) {
            const index = cookies.findIndex(
              (cookie) => cookie.name === nextCookie.name
            );

            if (index >= 0) {
              cookies[index] = nextCookie;
            } else {
              cookies.push(nextCookie);
            }
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function getLiveUpdateToken(baseUrl, cookieHeader) {
  const response = await fetch(`${baseUrl}/api/live-updates`, {
    headers: {
      cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Live update route failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.token;
}

async function fetchDashboardHtml(baseUrl, cookieHeader) {
  const response = await fetch(`${baseUrl}/dashboard`, {
    headers: {
      cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Dashboard route failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Dashboard response body is not streamable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    html += decoder.decode(value, { stream: true });
  }

  html += decoder.decode();

  return html;
}

function extractTotalAssets(html) {
  const match = html.match(
    /<p[^>]*>([^<]+)<\/p>\s*<p[^>]*>Total Assets<\/p>/i
  );

  if (!match?.[1]) {
    throw new Error("Unable to locate Total Assets KPI in dashboard HTML");
  }

  const value = Number(match[1].replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(value)) {
    throw new Error(`Unable to parse Total Assets KPI value: ${match[1]}`);
  }

  return value;
}

const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";
const sql = postgres(getRequiredEnv("DATABASE_URL"), {
  prepare: false,
  max: 1,
});

const { supabase, userId, email, password } = await createEphemeralUser();

let assetId = null;

try {
  const cookieHeader = await createCookieHeader(email, password);
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const assetCode = `AUTO-${suffix}`;
  const assetName = `Auto Refresh Probe ${suffix}`;

  const beforeHtml = await fetchDashboardHtml(baseUrl, cookieHeader);
  const beforeTotalAssets = extractTotalAssets(beforeHtml);

  const beforeToken = await getLiveUpdateToken(baseUrl, cookieHeader);

  const insertedRows = await sql`
    insert into assets (
      asset_code,
      name,
      type,
      criticality,
      exposure_level,
      status
    )
    values (
      ${assetCode},
      ${assetName},
      'atm',
      'medium',
      'internal',
      'active'
    )
    returning id
  `;

  assetId = insertedRows[0]?.id ?? null;

  if (!assetId) {
    throw new Error("Failed to insert probe asset");
  }

  const startedAt = performance.now();
  let afterToken = beforeToken;

  while (afterToken === beforeToken && performance.now() - startedAt < 12_000) {
    await delay(1_000);
    afterToken = await getLiveUpdateToken(baseUrl, cookieHeader);
  }

  const afterHtml = await fetchDashboardHtml(baseUrl, cookieHeader);
  const afterTotalAssets = extractTotalAssets(afterHtml);

  console.log(
    JSON.stringify(
      {
        tokenChanged: afterToken !== beforeToken,
        dashboardCountUpdatedWithoutManualRefresh:
          afterTotalAssets === beforeTotalAssets + 1,
        msToTokenChange: Number((performance.now() - startedAt).toFixed(1)),
        beforeTotalAssets,
        afterTotalAssets,
        assetCode,
      },
      null,
      2
    )
  );
} finally {
  if (assetId) {
    await sql`delete from assets where id = ${assetId}`;
  }

  await sql.end();
  await supabase.auth.admin.deleteUser(userId);
}
