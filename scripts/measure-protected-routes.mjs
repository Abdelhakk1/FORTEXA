import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import "dotenv/config";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function createEphemeralCredentials() {
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
    full_name: "Fortexa Route Probe",
    email,
    role_id: role.id,
    status: "active",
  });

  if (profileError) {
    throw profileError;
  }

  return {
    email,
    password,
    cleanup: () => supabase.auth.admin.deleteUser(data.user.id),
  };
}

async function getCredentials() {
  const email = process.env.FORTEXA_TEST_EMAIL?.trim();
  const password = process.env.FORTEXA_TEST_PASSWORD?.trim();

  if (email && password) {
    return {
      email,
      password,
      cleanup: null,
    };
  }

  return createEphemeralCredentials();
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

const routes = process.argv.slice(2);
const effectiveRoutes =
  routes.length > 0
    ? routes
    : ["/dashboard", "/assets", "/vulnerabilities", "/alerts", "/scan-import"];

const credentials = await getCredentials();
const cookieHeader = await createCookieHeader(
  credentials.email,
  credentials.password
);
const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";
const results = [];

try {
  for (const route of effectiveRoutes) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${route}`, {
      headers: {
        cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(30_000),
    });
    await response.text();

    results.push({
      route,
      status: response.status,
      ms: Number((performance.now() - startedAt).toFixed(1)),
    });
  }
} finally {
  await credentials.cleanup?.();
}

console.log(JSON.stringify(results, null, 2));
