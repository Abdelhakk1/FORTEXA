import { createHash, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import postgres from "postgres";
import { ensureSmokeUser } from "./smoke-auth.mjs";

loadEnv({ path: ".env.local", quiet: true });

const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function signIn(page, credentials) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.click("#email");
  await page.keyboard.type(credentials.email);
  await page.click("#password");
  await page.keyboard.type(credentials.password);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30_000 }),
    page.locator("form").getByRole("button", { name: /^sign in$/i }).click(),
  ]);
}

async function findRoleId(sql, roleName) {
  const [role] = await sql`
    select id from public.roles where name = ${roleName} limit 1
  `;

  if (!role?.id) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return role.id;
}

async function createConfirmedUser(supabase, sql, roleName) {
  const email = `fortexa.invite.${Date.now()}.${randomBytes(3).toString("hex")}@fortexa.local`;
  const password = `Fortexa!${randomBytes(12).toString("hex")}A1`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw error ?? new Error("Unable to create invited smoke user.");
  }

  const roleId = await findRoleId(sql, roleName);
  await sql`
    insert into public.profiles (id, full_name, email, role_id, status)
    values (${data.user.id}, ${email}, ${email}, ${roleId}, 'active')
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role_id = excluded.role_id,
        status = 'active'
  `;

  return { id: data.user.id, email, password };
}

function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

function hashInviteToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const adminCredentials = await ensureSmokeUser();
const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
const sql = postgres(requiredEnv("DATABASE_URL"), {
  prepare: false,
  max: 1,
});

try {
  const [membership] = await sql`
    select organization_id
    from public.organization_members
    where profile_id = ${adminCredentials.userId}
      and status = 'active'
    order by created_at asc
    limit 1
  `;

  if (!membership?.organization_id) {
    throw new Error("Smoke admin organization is missing.");
  }

  const invitedUser = await createConfirmedUser(supabase, sql, "security_analyst");
  const outsiderUser = await createConfirmedUser(supabase, sql, "security_analyst");
  const [outsiderOrg] = await sql`
    insert into public.organizations (
      name,
      slug,
      company_type,
      default_region,
      default_country,
      timezone,
      onboarding_completed,
      onboarding_step,
      completed_at
    )
    values (
      'Fortexa Outsider Smoke',
      ${`fortexa-outsider-${Date.now()}`},
      'bank',
      'Smoke',
      'Test',
      'UTC',
      true,
      'complete',
      now()
    )
    returning id
  `;

  await sql`
    insert into public.organization_members (organization_id, profile_id, role, status)
    values (${outsiderOrg.id}, ${outsiderUser.id}, 'security_analyst', 'active')
  `;

  const inviteToken = createInviteToken();
  await sql`
    insert into public.organization_invites (
      organization_id,
      email,
      role,
      token_hash,
      status,
      invited_by,
      expires_at
    )
    values (
      ${membership.organization_id},
      ${invitedUser.email},
      'security_analyst',
      ${hashInviteToken(inviteToken)},
      'pending',
      ${adminCredentials.userId},
      now() + interval '7 days'
    )
  `;

  const browser = await chromium.launch({ headless: true });
  const adminPage = await browser.newPage();
  const invitedPage = await browser.newPage();
  const consoleErrors = [];

  adminPage.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  invitedPage.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await signIn(adminPage, adminCredentials);
    await adminPage.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    await adminPage
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor({ timeout: 30_000 });

    const adminBefore = await adminPage.locator("body").innerText();

    if (adminBefore.includes(outsiderUser.email)) {
      throw new Error("Team section leaked a member from another organization.");
    }

    await invitedPage.goto(`${baseUrl}/invite/${inviteToken}`, {
      waitUntil: "domcontentloaded",
    });
    await invitedPage.click("#email");
    await invitedPage.keyboard.type(invitedUser.email);
    await invitedPage.click("#password");
    await invitedPage.keyboard.type(invitedUser.password);
    await invitedPage
      .locator("form")
      .getByRole("button", { name: /^sign in$/i })
      .click();
    try {
      await invitedPage
        .getByRole("button", { name: /^accept invite$/i })
        .waitFor({ timeout: 30_000 });
    } catch (error) {
      const body = await invitedPage.locator("body").innerText().catch(() => "");
      throw new Error(
        `Invite accept button did not appear at ${invitedPage.url()}: ${body.slice(0, 500)}`
      );
    }
    await invitedPage
      .getByRole("button", { name: /^accept invite$/i })
      .click();
    await invitedPage.waitForURL("**/dashboard", { timeout: 30_000 });

    await adminPage.getByText(invitedUser.email).waitFor({ timeout: 20_000 });
    await adminPage
      .getByText(`${invitedUser.email} joined your Fortexa organization.`)
      .waitFor({ timeout: 20_000 });

    await invitedPage.goto(`${baseUrl}/settings`, {
      waitUntil: "domcontentloaded",
    });
    await invitedPage
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor({ timeout: 30_000 });
    const invitedSettings = await invitedPage.locator("body").innerText();

    const failed =
      consoleErrors.length > 0 ||
      invitedSettings.includes("This page could not load") ||
      !invitedSettings.includes("Your role can view team membership") ||
      invitedSettings.includes("Manual invite link") ||
      invitedSettings.includes(outsiderUser.email);

    console.log(
      JSON.stringify(
        {
          result: failed ? "failed" : "passed",
          baseUrl,
          invitedMemberCanOpenSettings: !invitedSettings.includes(
            "This page could not load"
          ),
          lowerRoleInviteControlsHidden:
            invitedSettings.includes("Your role can view team membership") &&
            !invitedSettings.includes("Manual invite link"),
          adminSawJoinedMember: true,
          adminSawJoinToast: true,
          orgScopedTeamSection: !invitedSettings.includes(outsiderUser.email),
          consoleErrors,
        },
        null,
        2
      )
    );

    process.exit(failed ? 1 : 0);
  } finally {
    await browser.close();
  }
} finally {
  await sql.end();
}
