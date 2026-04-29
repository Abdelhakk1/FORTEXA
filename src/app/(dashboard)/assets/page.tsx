import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { listAssets } from "@/lib/services/assets";
import { startServerTiming } from "@/lib/observability/timing";
import { AssetsPageClient } from "./assets-page-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const timing = startServerTiming("route.assets.page");
  await requirePermission("assets.read");
  const activeOrganization = await requireActiveOrganization();
  const params = await searchParams;
  const filters = {
    search: getValue(params.search) ?? "",
    type: getValue(params.type) ?? "all",
    regionId: getValue(params.regionId) ?? "all",
    criticality: getValue(params.criticality) ?? "all",
    status: getValue(params.status) ?? "all",
    exposureLevel: getValue(params.exposureLevel) ?? "all",
    page: Number(getValue(params.page) ?? "1") || 1,
  };

  const data = await listAssets(activeOrganization.organization.id, {
    search: filters.search,
    type: filters.type,
    regionId: filters.regionId,
    criticality: filters.criticality,
    status: filters.status,
    exposureLevel: filters.exposureLevel,
    page: filters.page,
  });
  timing.end({ total: data.assets.total });

  return <AssetsPageClient data={data} filters={filters} />;
}
