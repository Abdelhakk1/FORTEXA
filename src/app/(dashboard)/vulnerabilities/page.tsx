import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { getVulnerabilityOverviewData } from "@/lib/services/vulnerabilities";
import { startServerTiming } from "@/lib/observability/timing";
import VulnerabilitiesPageClient from "./vulnerabilities-page-client";

export default async function VulnerabilitiesPage() {
  const timing = startServerTiming("route.vulnerabilities.page");
  await requirePermission("asset_vulnerabilities.read");
  const activeOrganization = await requireActiveOrganization();
  const data = await getVulnerabilityOverviewData(activeOrganization.organization.id);
  timing.end({ vulnerabilities: data.vulnerabilities.length });

  return <VulnerabilitiesPageClient data={data} />;
}
