import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { listAlerts } from "@/lib/services/alerts";
import { startServerTiming } from "@/lib/observability/timing";
import { AlertsPageClient } from "./alerts-page-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const timing = startServerTiming("route.alerts.page");
  await requirePermission("alerts.read");
  const activeOrganization = await requireActiveOrganization();
  const params = await searchParams;
  const filters = {
    search: getValue(params.search) ?? "",
    severity: getValue(params.severity) ?? "all",
    type: getValue(params.type) ?? "all",
    status: getValue(params.status) ?? "all",
    ownerId: getValue(params.ownerId) ?? "all",
  };

  const data = await listAlerts(activeOrganization.organization.id, {
    search: filters.search,
    severity: filters.severity,
    type: filters.type,
    status: filters.status,
    ownerId: filters.ownerId,
  });
  timing.end({ total: data.alerts.total });

  return <AlertsPageClient data={data} filters={filters} />;
}
