import { requirePermission } from "@/lib/auth";
import { getVulnerabilityOverviewData } from "@/lib/services/vulnerabilities";
import { startServerTiming } from "@/lib/observability/timing";
import VulnerabilitiesPageClient from "./vulnerabilities-page-client";

export default async function VulnerabilitiesPage() {
  const timing = startServerTiming("route.vulnerabilities.page");
  await requirePermission("asset_vulnerabilities.read");
  const data = await getVulnerabilityOverviewData();
  timing.end({ vulnerabilities: data.vulnerabilities.length });

  return <VulnerabilitiesPageClient data={data} />;
}
