import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local", quiet: true });

const args = new Set(process.argv.slice(2));
const execute = args.has("--yes");
const dryRun = !execute || args.has("--dry-run");
const allowAutomation =
  args.has("--allow-automation") ||
  process.env.FORTEXA_ALLOW_AUTOMATED_RESET === "true" ||
  process.env.FORTEXA_ALLOW_AUTOMATED_RESET === "1";

const databaseUrl = process.env.DATABASE_URL?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const reportsBucket =
  process.env.FORTEXA_REPORTS_BUCKET?.trim() || "fortexa-reports";
const scanImportsBucket =
  process.env.FORTEXA_SCAN_IMPORTS_BUCKET?.trim() || "fortexa-scan-imports";

const tenantTables = [
  ["public", "alerts"],
  ["public", "asset_vulnerability_enrichments"],
  ["public", "asset_vulnerability_events"],
  ["public", "remediation_tasks"],
  ["public", "generated_reports"],
  ["public", "report_definitions"],
  ["public", "scan_findings"],
  ["public", "asset_vulnerabilities"],
  ["public", "scan_imports"],
  ["public", "assets"],
  ["public", "sites"],
  ["public", "organization_invites"],
  ["public", "organization_members"],
  ["public", "organization_settings"],
  ["public", "organizations"],
  ["public", "audit_logs"],
];

const profileReferenceColumns = [
  ["public", "scoring_policies", "created_by"],
  ["public", "cve_enrichments", "enriched_by"],
];

const preservedData = [
  "schema and migration history",
  "Postgres enums",
  "roles and permission definitions",
  "regions",
  "scoring policies",
  "CVE intelligence/reference tables",
  "scanner/import configuration stored as code or seed/reference data",
];

function fail(message) {
  console.error(JSON.stringify({ result: "failed", message }, null, 2));
  process.exit(1);
}

function assertRequiredEnv() {
  if (!databaseUrl) {
    fail("Missing required environment variable: DATABASE_URL");
  }

  if (!supabaseUrl) {
    fail("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    fail("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  if ((process.env.VERCEL || process.env.CI) && execute && !allowAutomation) {
    fail("Refusing to reset data in CI or Vercel without --allow-automation.");
  }
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function qualifiedTable([schema, table]) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function tableKey([schema, table]) {
  return `${schema}.${table}`;
}

async function tableExists(sql, [schema, table]) {
  const [row] = await sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = ${schema}
        and table_name = ${table}
    ) as exists
  `;

  return row?.exists === true;
}

async function columnExists(sql, [schema, table], column) {
  const [row] = await sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = ${schema}
        and table_name = ${table}
        and column_name = ${column}
    ) as exists
  `;

  return row?.exists === true;
}

async function existingTables(sql, tables) {
  const result = [];

  for (const table of tables) {
    if (await tableExists(sql, table)) {
      result.push(table);
    }
  }

  return result;
}

async function countRows(sql, tables) {
  const counts = {};

  for (const table of tables) {
    const [row] = await sql.unsafe(
      `select count(*)::int as count from ${qualifiedTable(table)}`
    );
    counts[tableKey(table)] = row?.count ?? 0;
  }

  if (await tableExists(sql, ["public", "profiles"])) {
    const [row] = await sql`select count(*)::int as count from public.profiles`;
    counts["public.profiles"] = row?.count ?? 0;
  }

  return counts;
}

async function listAuthUsers(supabase) {
  const users = [];

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    users.push(...data.users);

    if (data.users.length < 1000) {
      break;
    }
  }

  return users;
}

async function deleteAuthUsers(supabase, users) {
  let deleted = 0;

  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id, false);

    if (error) {
      throw new Error(`Unable to delete an auth user: ${error.message}`);
    }

    deleted += 1;
  }

  return deleted;
}

async function collectStoragePaths(sql) {
  const reports = [];
  const scanImports = [];

  if (
    (await tableExists(sql, ["public", "generated_reports"])) &&
    (await columnExists(sql, ["public", "generated_reports"], "storage_path"))
  ) {
    const rows = await sql`
      select storage_path
      from public.generated_reports
      where storage_path is not null
    `;
    reports.push(...rows.map((row) => row.storage_path).filter(Boolean));
  }

  if (
    (await tableExists(sql, ["public", "scan_imports"])) &&
    (await columnExists(sql, ["public", "scan_imports"], "storage_path"))
  ) {
    const rows = await sql`
      select storage_path
      from public.scan_imports
      where storage_path is not null
    `;
    scanImports.push(...rows.map((row) => row.storage_path).filter(Boolean));
  }

  return { reports, scanImports };
}

async function removeStorageObjects(supabase, bucket, paths) {
  let removed = 0;
  const warnings = [];

  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);

    if (chunk.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(bucket).remove(chunk);

    if (error) {
      warnings.push(
        `Unable to remove ${chunk.length} storage object(s) from ${bucket}: ${error.message}`
      );
      continue;
    }

    removed += chunk.length;
  }

  return { removed, warnings };
}

async function clearApplicationData(sql, tables) {
  await sql.begin(async (tx) => {
    for (const [schema, table, column] of profileReferenceColumns) {
      if (
        (await tableExists(tx, [schema, table])) &&
        (await columnExists(tx, [schema, table], column))
      ) {
        await tx.unsafe(
          `update ${qualifiedTable([schema, table])} set ${quoteIdentifier(column)} = null`
        );
      }
    }

    if (tables.length > 0) {
      const qualifiedTables = tables.map(qualifiedTable).join(", ");
      await tx.unsafe(`truncate ${qualifiedTables} restart identity cascade`);
    }

    if (await tableExists(tx, ["public", "profiles"])) {
      await tx`delete from public.profiles`;
    }

    await tx`notify pgrst, 'reload schema'`;
  });
}

assertRequiredEnv();

const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "unknown";
  }
})();

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  connect_timeout: 8,
  idle_timeout: 5,
});

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

try {
  const tables = await existingTables(sql, tenantTables);
  const users = await listAuthUsers(supabase);
  const storagePaths = await collectStoragePaths(sql);
  const before = await countRows(sql, tables);

  const summary = {
    mode: dryRun ? "dry_run" : "execute",
    databaseHost,
    deletes: {
      authUsers: users.length,
      tables: tables.map(tableKey),
      profiles: before["public.profiles"] ?? 0,
      reportStorageObjects: storagePaths.reports.length,
      scanImportStorageObjects: storagePaths.scanImports.length,
      auditLogs: before["public.audit_logs"] ?? 0,
    },
    preserves: preservedData,
    before,
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          result: "dry_run",
          message: "No data was deleted. Re-run with npm run db:reset:test -- --yes to execute.",
          ...summary,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const deletedAuthUsers = await deleteAuthUsers(supabase, users);
  await clearApplicationData(sql, tables);
  const reportStorage = await removeStorageObjects(
    supabase,
    reportsBucket,
    storagePaths.reports
  );
  const scanImportStorage = await removeStorageObjects(
    supabase,
    scanImportsBucket,
    storagePaths.scanImports
  );
  const after = await countRows(sql, tables);

  console.log(
    JSON.stringify(
      {
        result: "reset_complete",
        databaseHost,
        deleted: {
          authUsers: deletedAuthUsers,
          reportStorageObjects: reportStorage.removed,
          scanImportStorageObjects: scanImportStorage.removed,
        },
        storageWarnings: [
          ...reportStorage.warnings,
          ...scanImportStorage.warnings,
        ],
        preserves: preservedData,
        before,
        after,
      },
      null,
      2
    )
  );
} catch (error) {
  fail(error instanceof Error ? error.message : "Unknown reset failure.");
} finally {
  await sql.end();
}
