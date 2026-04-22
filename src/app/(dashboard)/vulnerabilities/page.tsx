import { requireAuth } from "@/lib/auth";
import { getVulnerabilityOverviewData } from "@/lib/services/vulnerabilities";
import VulnerabilitiesPageClient from "./vulnerabilities-page-client";

export default async function VulnerabilitiesPage() {
  await requireAuth();
  const data = await getVulnerabilityOverviewData();

  return <VulnerabilitiesPageClient data={data} />;
}
