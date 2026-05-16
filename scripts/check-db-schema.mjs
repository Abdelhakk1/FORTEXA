import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL. Add it to .env.local or the environment.");
}

const refreshSchemaCache = process.argv.includes("--refresh-schema-cache");
const requiredColumns = [
  ["assets", "organization_id"],
  ["assets", "gab_exposure_type"],
  ["assets", "cidt_confidentiality"],
  ["assets", "cidt_integrity"],
  ["assets", "cidt_availability"],
  ["assets", "cidt_traceability"],
  ["assets", "cidt_override_enabled"],
  ["assets", "business_application_id"],
  ["scan_imports", "organization_id"],
  ["scan_findings", "organization_id"],
  ["asset_vulnerabilities", "organization_id"],
  ["asset_vulnerabilities", "priority_factors"],
  ["asset_vulnerability_events", "organization_id"],
  ["asset_vulnerability_enrichments", "organization_id"],
  ["cve_source_references", "cve_id"],
  ["cve_source_references", "source_type"],
  ["cve_source_references", "retrieved_at"],
  ["cve_source_references", "supported_facts"],
  ["cve_source_references", "retrieval_metadata"],
  ["business_applications", "organization_id"],
  ["business_applications", "key"],
  ["business_applications", "label"],
  ["business_applications", "cidt_confidentiality"],
  ["business_applications", "cidt_integrity"],
  ["business_applications", "cidt_availability"],
  ["business_applications", "cidt_traceability"],
  ["business_applications", "is_internet_exposed"],
  ["gab_cidt_templates", "organization_id"],
  ["gab_cidt_templates", "template_key"],
  ["gab_cidt_templates", "cidt_confidentiality"],
  ["gab_cidt_templates", "cidt_integrity"],
  ["gab_cidt_templates", "cidt_availability"],
  ["gab_cidt_templates", "cidt_traceability"],
  ["asset_classification_rules", "organization_id"],
  ["asset_classification_rules", "field"],
  ["asset_classification_rules", "match_value"],
  ["asset_classification_rules", "gab_exposure_type"],
  ["asset_classification_rules", "enabled"],
  ["remediation_tasks", "organization_id"],
  ["alerts", "organization_id"],
  ["report_definitions", "organization_id"],
  ["generated_reports", "organization_id"],
  ["audit_logs", "organization_id"],
];

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
});

function isConnectionFailure(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    code === "CONNECT_TIMEOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("connect timeout") ||
    isConnectionFailure(error.cause)
  );
}

async function runAuditLogChecks() {
  const suffix = randomUUID().slice(0, 8);
  let transactionStarted = false;

  try {
    await sql`begin`;
    transactionStarted = true;

    const [organization] = await sql`
      insert into public.organizations (
        name,
        slug,
        company_type,
        timezone,
        onboarding_completed,
        onboarding_step,
        completed_at,
        metadata
      )
      values (
        ${`Fortexa Audit Smoke ${suffix}`},
        ${`fortexa-audit-smoke-${suffix}`},
        'internal_security',
        'UTC',
        true,
        'complete',
        now(),
        ${sql.json({ smoke: true })}
      )
      returning id
    `;

    const [auditLog] = await sql`
      insert into public.audit_logs (
        organization_id,
        action,
        resource_type,
        resource_id,
        details
      )
      values (
        ${organization.id},
        'smoke.audit_insert',
        'smoke',
        ${`audit-smoke-${suffix}`},
        ${sql.json({ smoke: true })}
      )
      returning id, organization_id
    `;

    if (auditLog.organization_id !== organization.id) {
      throw new Error("Inserted audit log did not keep organization_id.");
    }

    await sql`
      create temp table _fortexa_audit_smoke_ids (
        audit_id uuid not null
      ) on commit drop
    `;
    await sql`
      insert into _fortexa_audit_smoke_ids (audit_id)
      values (${auditLog.id})
    `;

    await sql`
      do $$
      declare
        target_id uuid;
      begin
        select audit_id into target_id from _fortexa_audit_smoke_ids limit 1;

        begin
          update public.audit_logs
          set details = jsonb_build_object('blocked', true)
          where id = target_id;
          raise exception 'audit_logs update unexpectedly succeeded';
        exception
          when raise_exception then
            if sqlerrm <> 'audit_logs is append-only: UPDATE and DELETE are prohibited' then
              raise;
            end if;
        end;

        begin
          delete from public.audit_logs
          where id = target_id;
          raise exception 'audit_logs delete unexpectedly succeeded';
        exception
          when raise_exception then
            if sqlerrm <> 'audit_logs is append-only: UPDATE and DELETE are prohibited' then
              raise;
            end if;
        end;
      end $$;
    `;

    await sql`rollback`;
    transactionStarted = false;

    return {
      insertWithOrganizationId: true,
      updateRejected: true,
      deleteRejected: true,
      rolledBack: true,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await sql`rollback`;
      } catch {
        // The original smoke failure is more useful than a rollback failure.
      }
    }

    throw error;
  }
}

async function runRlsPolicyChecks() {
  const tableNames = Array.from(new Set(requiredColumns.map(([table]) => table)));
  const memberScopedTableNames = tableNames.filter(
    (table) => table !== "cve_source_references"
  );
  const rlsRows = await sql`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in ${sql(tableNames)}
  `;
  const policyRows = await sql`
    select tablename as table_name, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ${sql(tableNames)}
  `;
  const rlsByTable = new Map(
    rlsRows.map((row) => [row.table_name, row.rls_enabled === true])
  );
  const policiesByTable = new Map();

  for (const row of policyRows) {
    const policies = policiesByTable.get(row.table_name) ?? [];
    policies.push(row);
    policiesByTable.set(row.table_name, policies);
  }

  const missing = tableNames.filter((table) => !rlsByTable.get(table));
  const missingPolicies = memberScopedTableNames.filter(
    (table) => (policiesByTable.get(table) ?? []).length === 0
  );
  const missingOrgMemberPolicies = memberScopedTableNames.filter((table) => {
    const policies = policiesByTable.get(table) ?? [];
    return !policies.some((policy) =>
      `${policy.qual ?? ""} ${policy.with_check ?? ""}`.includes(
        "fortexa_is_org_member"
      )
    );
  });

  if (missing.length || missingPolicies.length || missingOrgMemberPolicies.length) {
    throw new Error(
      `RLS policy smoke failed: ${JSON.stringify({
        missing,
        missingPolicies,
        missingOrgMemberPolicies,
      })}`
    );
  }

  return {
    rlsEnabled: tableNames.length,
    memberScopedPolicies: memberScopedTableNames.length,
  };
}

try {
  const rows = await sql`
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ${sql(requiredColumns.map(([table]) => table))}
      and column_name in ${sql(Array.from(new Set(requiredColumns.map(([, column]) => column))))}
    order by table_name, column_name
  `;

  const found = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = requiredColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((key) => !found.has(key));

  if (refreshSchemaCache) {
    await sql`notify pgrst, 'reload schema'`;
  }

  if (missing.length > 0) {
    console.error(
      JSON.stringify(
        {
          result: "failed",
          missing,
          refreshedPostgrestSchemaCache: refreshSchemaCache,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    const auditLogChecks = await runAuditLogChecks();
    const rlsPolicyChecks = await runRlsPolicyChecks();

    console.log(
      JSON.stringify(
        {
          result: "passed",
          checked: requiredColumns.map(([table, column]) => `${table}.${column}`),
          auditLogChecks,
          rlsPolicyChecks,
          refreshedPostgrestSchemaCache: refreshSchemaCache,
        },
        null,
        2
      )
    );
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        result: "failed",
        reason: isConnectionFailure(error)
          ? "database_unreachable"
          : "schema_smoke_failed",
        code:
          error && typeof error === "object" && "code" in error
            ? error.code
            : "unknown",
        message: error instanceof Error ? error.message : "Unknown database error.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
