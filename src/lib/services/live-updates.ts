import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { measureServerTiming } from "@/lib/observability/timing";

export type LiveScope =
  | "dashboard"
  | "assets"
  | "vulnerabilities"
  | "alerts"
  | "remediation"
  | "scan-import"
  | "reports";

export function buildProtectedAreaLiveTokenQuery(
  scope: LiveScope,
  organizationId: string
) {
  const queries: Record<LiveScope, ReturnType<typeof sql>> = {
    dashboard: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((
        select extract(epoch from max(c.updated_at))::bigint
        from cves c
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = c.id
        )
      ), 0),
      coalesce((
        select extract(epoch from max(ce.updated_at))::bigint
        from cve_enrichments ce
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = ce.cve_id
        )
      ), 0),
      coalesce((
        select extract(epoch from max(csr.updated_at))::bigint
        from cve_source_references csr
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = csr.cve_id
        )
      ), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerability_enrichments where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports where organization_id = ${organizationId}), 0),
      coalesce((
        select extract(
          epoch from max(
            greatest(
              created_at,
              coalesce(acknowledged_at, created_at),
              coalesce(resolved_at, created_at)
            )
          )
        )::bigint
        from alerts
        where organization_id = ${organizationId}
      ), 0),
      coalesce((select count(*)::bigint from alerts where organization_id = ${organizationId} and status in ('new', 'acknowledged')), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed'), 0)
    ) as token
  `,
    assets: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from assets where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed'), 0)
    ) as token
  `,
    vulnerabilities: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((
        select extract(epoch from max(c.updated_at))::bigint
        from cves c
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = c.id
        )
      ), 0),
      coalesce((
        select extract(epoch from max(ce.updated_at))::bigint
        from cve_enrichments ce
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = ce.cve_id
        )
      ), 0),
      coalesce((
        select extract(epoch from max(csr.updated_at))::bigint
        from cve_source_references csr
        where exists (
          select 1 from asset_vulnerabilities av
          where av.organization_id = ${organizationId}
            and av.cve_id = csr.cve_id
        )
      ), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerability_enrichments where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed'), 0),
      coalesce((select count(*)::bigint from alerts where organization_id = ${organizationId} and status in ('new', 'acknowledged')), 0)
    ) as token
  `,
    alerts: sql`
    select concat_ws(
      ':',
      coalesce((
        select extract(
          epoch from max(
            greatest(
              created_at,
              coalesce(acknowledged_at, created_at),
              coalesce(resolved_at, created_at)
            )
          )
        )::bigint
        from alerts
        where organization_id = ${organizationId}
      ), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from alerts where organization_id = ${organizationId} and status in ('new', 'acknowledged')), 0)
    ) as token
  `,
    remediation: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from remediation_tasks where organization_id = ${organizationId} and status in ('open', 'assigned', 'in_progress', 'overdue')), 0)
    ) as token
  `,
    "scan-import": sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from assets where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerability_enrichments where organization_id = ${organizationId}), 0),
      coalesce((select count(*)::bigint from scan_imports where organization_id = ${organizationId}), 0)
    ) as token
  `,
    reports: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports where organization_id = ${organizationId}), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks where organization_id = ${organizationId}), 0),
      coalesce((
        select extract(
          epoch from max(
            greatest(
              created_at,
              coalesce(acknowledged_at, created_at),
              coalesce(resolved_at, created_at)
            )
          )
        )::bigint
        from alerts
        where organization_id = ${organizationId}
      ), 0)
    ) as token
  `,
  };

  return queries[scope];
}

export function toLiveScope(value: string | null | undefined): LiveScope {
  switch (value) {
    case "assets":
    case "vulnerabilities":
    case "alerts":
    case "remediation":
    case "scan-import":
    case "reports":
      return value;
    default:
      return "dashboard";
  }
}

export async function getProtectedAreaLiveToken(
  scope: LiveScope,
  organizationId: string
) {
  const db = getDb();

  if (!db) {
    return "no-db";
  }

  return measureServerTiming(
    "liveUpdates.token",
    async () => {
      const [row] = await db.execute(
        buildProtectedAreaLiveTokenQuery(scope, organizationId)
      );

      return String(row?.token ?? "0");
    }
  );
}
