import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });

const execute = process.argv.includes("--execute");
const confirmReset =
  process.env.FORTEXA_RESET_CONFIRM === "RESET_FORTEXA_DEV_DATA";
const allowHosted =
  process.env.FORTEXA_ALLOW_HOSTED_RESET === "true" ||
  process.env.FORTEXA_ALLOW_HOSTED_RESET === "1";
const allowAutomation =
  process.env.FORTEXA_ALLOW_AUTOMATED_RESET === "true" ||
  process.env.FORTEXA_ALLOW_AUTOMATED_RESET === "1";
const databaseUrl = process.env.DATABASE_URL?.trim();

const tables = [
  `"public"."generated_reports"`,
  `"public"."report_definitions"`,
  `"public"."alerts"`,
  `"public"."remediation_tasks"`,
  `"public"."asset_vulnerability_enrichments"`,
  `"public"."asset_vulnerability_events"`,
  `"public"."asset_vulnerabilities"`,
  `"public"."scan_findings"`,
  `"public"."scan_imports"`,
  `"public"."assets"`,
  `"public"."sites"`,
  `"public"."organization_settings"`,
  `"public"."organization_members"`,
  `"public"."organizations"`,
  `"public"."audit_logs"`,
  `"public"."profiles"`,
  `"auth"."users"`,
];

function assertSafeToExecute() {
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  if (!execute) {
    return;
  }

  if (!confirmReset) {
    throw new Error(
      "Refusing to reset data. Set FORTEXA_RESET_CONFIRM=RESET_FORTEXA_DEV_DATA and pass --execute."
    );
  }

  if ((process.env.VERCEL || process.env.CI) && !allowAutomation) {
    throw new Error(
      "Refusing to reset data in an automated/deployment environment."
    );
  }

  const parsed = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!localHosts.has(parsed.hostname) && !allowHosted) {
    throw new Error(
      "Hosted Supabase reset requires FORTEXA_ALLOW_HOSTED_RESET=true."
    );
  }
}

async function countRows(sql) {
  const counts = {};

  for (const table of tables) {
    const [row] = await sql.unsafe(
      `select count(*)::int as count from ${table}`
    );
    counts[table.replaceAll('"', "")] = row.count;
  }

  return counts;
}

assertSafeToExecute();

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  connect_timeout: 8,
  idle_timeout: 5,
});

try {
  const before = await countRows(sql);

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          result: "dry_run",
          message:
            "No data was deleted. Re-run with --execute and the required confirmation environment variables.",
          counts: before,
          required: {
            confirm: "FORTEXA_RESET_CONFIRM=RESET_FORTEXA_DEV_DATA",
            hostedSupabase: "FORTEXA_ALLOW_HOSTED_RESET=true",
          },
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(`truncate ${tables.join(", ")} restart identity cascade`);
  });

  const after = await countRows(sql);

  console.log(
    JSON.stringify(
      {
        result: "reset_complete",
        before,
        after,
      },
      null,
      2
    )
  );
} finally {
  await sql.end();
}
