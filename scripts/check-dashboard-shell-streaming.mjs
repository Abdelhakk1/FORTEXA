import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { TextDecoder } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config as loadEnv } from "dotenv";

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

const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";
const decoder = new TextDecoder();

const { supabase, userId, email, password } = await createEphemeralUser();

try {
  const cookieHeader = await createCookieHeader(email, password);
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/dashboard`, {
    headers: {
      cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Dashboard request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Dashboard response body is not streamable");
  }

  const reader = response.body.getReader();
  let firstChunkMs = null;
  let shellSeenMs = null;
  let summarySeenMs = null;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (firstChunkMs === null) {
      firstChunkMs = Number((performance.now() - startedAt).toFixed(1));
    }

    html += decoder.decode(value, { stream: true });

    if (shellSeenMs === null && html.includes("Security Dashboard")) {
      shellSeenMs = Number((performance.now() - startedAt).toFixed(1));
    }

    if (
      summarySeenMs === null &&
      html.includes("Dashboard widgets refresh after data-changing actions.")
    ) {
      summarySeenMs = Number((performance.now() - startedAt).toFixed(1));
    }
  }

  html += decoder.decode();

  console.log(
    JSON.stringify(
      {
        status: response.status,
        firstChunkMs,
        shellSeenMs,
        completeMs: Number((performance.now() - startedAt).toFixed(1)),
        shellVisibleBeforeComplete:
          shellSeenMs !== null &&
          shellSeenMs < Number((performance.now() - startedAt).toFixed(1)),
        summaryVisible: summarySeenMs !== null,
      },
      null,
      2
    )
  );
} finally {
  await supabase.auth.admin.deleteUser(userId);
}
