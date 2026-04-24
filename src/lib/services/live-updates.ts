import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { measureServerTiming } from "@/lib/observability/timing";

type LiveScope =
  | "dashboard"
  | "assets"
  | "vulnerabilities"
  | "alerts"
  | "remediation"
  | "scan-import"
  | "reports";

const LIVE_SCOPE_TOKENS: Record<LiveScope, ReturnType<typeof sql>> = {
  dashboard: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from cves), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from cve_enrichments), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerability_enrichments), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports), 0),
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
      ), 0),
      coalesce((select count(*)::bigint from alerts where status in ('new', 'acknowledged')), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where status <> 'closed'), 0)
    ) as token
  `,
  assets: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports), 0),
      coalesce((select count(*)::bigint from assets), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where status <> 'closed'), 0)
    ) as token
  `,
  vulnerabilities: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from cves), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from cve_enrichments), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerability_enrichments), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks), 0),
      coalesce((select count(*)::bigint from asset_vulnerabilities where status <> 'closed'), 0),
      coalesce((select count(*)::bigint from alerts where status in ('new', 'acknowledged')), 0)
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
      ), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks), 0),
      coalesce((select count(*)::bigint from alerts where status in ('new', 'acknowledged')), 0)
    ) as token
  `,
  remediation: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select count(*)::bigint from remediation_tasks), 0),
      coalesce((select count(*)::bigint from remediation_tasks where status in ('open', 'assigned', 'in_progress', 'overdue')), 0)
    ) as token
  `,
  "scan-import": sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from assets), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select count(*)::bigint from scan_imports), 0)
    ) as token
  `,
  reports: sql`
    select concat_ws(
      ':',
      coalesce((select extract(epoch from max(updated_at))::bigint from assets), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from asset_vulnerabilities), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from scan_imports), 0),
      coalesce((select extract(epoch from max(updated_at))::bigint from remediation_tasks), 0),
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
      ), 0)
    ) as token
  `,
};

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

export async function getProtectedAreaLiveToken(scope: LiveScope = "dashboard") {
  const db = getDb();

  if (!db) {
    return "no-db";
  }

  return measureServerTiming(
    "liveUpdates.token",
    async () => {
      const [row] = await db.execute(LIVE_SCOPE_TOKENS[scope]);

      return String(row?.token ?? "0");
    }
  );
}
