import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local", quiet: true });

export function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createSupabaseAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function withRetry(label, fn, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "unknown failure";
  throw new Error(`${label} failed after ${attempts} attempts: ${message}`);
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await withRetry("list auth users", () =>
      supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
    );

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

export async function ensureSmokeUser() {
  const supabase = createSupabaseAdminClient();
  const email =
    process.env.FORTEXA_SMOKE_EMAIL?.trim() ||
    `fortexa.smoke.${Date.now()}.${randomBytes(4).toString("hex")}@fortexa.local`;
  const password = `Fortexa!${randomBytes(12).toString("hex")}A1`;
  const existingUser = await findAuthUserByEmail(supabase, email);
  const userResult = await withRetry("prepare smoke user", () =>
    existingUser
      ? supabase.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
        })
      : supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
  );

  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new Error("Failed to create smoke user.");
  }

  const { data: role, error: roleError } = await withRetry("load admin role", () =>
    supabase.from("roles").select("id").eq("name", "administrator").single()
  );

  if (roleError || !role) {
    throw roleError ?? new Error("Administrator role not found.");
  }

  const { error: profileError } = await withRetry("upsert smoke profile", () =>
    supabase.from("profiles").upsert({
      id: userResult.data.user.id,
      full_name: "Fortexa Smoke Tester",
      email,
      role_id: role.id,
      status: "active",
    })
  );

  if (profileError) {
    throw profileError;
  }

  const { data: organization, error: organizationError } = await withRetry(
    "load smoke organization",
    () =>
      supabase
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
  );

  if (organizationError) {
    throw organizationError;
  }

  const activeOrganization =
    organization ??
    (
      await withRetry("create smoke organization", () =>
        supabase
          .from("organizations")
          .insert({
            name: "Fortexa Smoke Workspace",
            slug: "fortexa-smoke-workspace",
            company_type: "bank",
            default_region: "Smoke Region",
            default_country: "Test",
            timezone: "UTC",
            onboarding_completed: true,
            onboarding_step: "complete",
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single()
      )
    ).data;

  if (!activeOrganization?.id) {
    throw new Error("Smoke organization could not be prepared.");
  }

  const { error: membershipError } = await withRetry("upsert smoke membership", () =>
    supabase.from("organization_members").upsert(
      {
        organization_id: activeOrganization.id,
        profile_id: userResult.data.user.id,
        role: "owner",
        status: "active",
      },
      { onConflict: "organization_id,profile_id" }
    )
  );

  if (membershipError) {
    throw membershipError;
  }

  const { error: settingsError } = await withRetry("upsert smoke settings", () =>
    supabase.from("organization_settings").upsert(
      {
        organization_id: activeOrganization.id,
        operating_context: {
          atmGabFleet: true,
          vendorManagedSystems: false,
        },
        notifications: {
          emailEnabled: false,
          importFailures: true,
          taskAssignments: true,
          slaBreaches: true,
          aiFailures: true,
          dailyDigest: false,
        },
        scanner_settings: {
          nessus: true,
          openvas: false,
          nmap: false,
          qualys: false,
        },
      },
      { onConflict: "organization_id" }
    )
  );

  if (settingsError) {
    throw settingsError;
  }

  const browserSupabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { error: signInError } = await withRetry("verify smoke sign-in", () =>
    browserSupabase.auth.signInWithPassword({
      email,
      password,
    })
  );

  if (signInError) {
    throw signInError;
  }

  await browserSupabase.auth.signOut();

  return {
    email,
    password,
    userId: userResult.data.user.id,
  };
}
