import { requireAuth } from "@/lib/auth";
import { listAlerts } from "@/lib/services/alerts";
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
  await requireAuth();

  const params = await searchParams;
  const filters = {
    search: getValue(params.search) ?? "",
    severity: getValue(params.severity) ?? "all",
    type: getValue(params.type) ?? "all",
    status: getValue(params.status) ?? "all",
    ownerId: getValue(params.ownerId) ?? "all",
  };

  const data = await listAlerts({
    search: filters.search,
    severity: filters.severity,
    type: filters.type,
    status: filters.status,
    ownerId: filters.ownerId,
  });

  return <AlertsPageClient data={data} filters={filters} />;
}
