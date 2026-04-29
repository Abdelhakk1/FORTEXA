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
  ["scan_imports", "organization_id"],
  ["scan_findings", "organization_id"],
  ["asset_vulnerabilities", "organization_id"],
  ["asset_vulnerability_events", "organization_id"],
  ["asset_vulnerability_enrichments", "organization_id"],
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

try {
  const rows = await sql`
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ${sql(requiredColumns.map(([table]) => table))}
      and column_name = 'organization_id'
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

    console.log(
      JSON.stringify(
        {
          result: "passed",
          checked: requiredColumns.map(([table, column]) => `${table}.${column}`),
          auditLogChecks,
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
