import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getVulnerabilityDetail } from "@/lib/services/vulnerabilities";
import CveDetailClient from "./cve-detail-client";

type Params = Promise<{ id: string }>;

export default async function VulnerabilityDetailPage({
  params,
}: {
  params: Params;
}) {
  const identity = await requireAuth();
  const { id } = await params;
  const data = await getVulnerabilityDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <CveDetailClient
      data={data}
      canRetryEnrichment={identity.permissions.includes("cves.enrich")}
    />
  );
}
