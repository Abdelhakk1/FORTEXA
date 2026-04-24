import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import {
  getAssetVulnerabilityDetail,
  resolveAssetVulnerabilityIdFromRoute,
} from "@/lib/services/asset-vulnerabilities";
import { listAssignableProfiles } from "@/lib/services/remediation";
import AssetVulnerabilityDetailClient from "./asset-vulnerability-detail-client";

type Params = Promise<{ id: string }>;

export default async function VulnerabilityDetailPage({
  params,
}: {
  params: Params;
}) {
  const identity = await requirePermission("asset_vulnerabilities.read");
  const { id } = await params;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    const data = await getAssetVulnerabilityDetail(id);

    if (!data) {
      notFound();
    }

    const assignableProfiles = identity.permissions.includes("remediation.write")
      ? await listAssignableProfiles()
      : [];

    return (
      <AssetVulnerabilityDetailClient
        data={data}
        assignableProfiles={assignableProfiles}
        canRetryEnrichment={identity.permissions.includes("cves.enrich")}
        canUpdateLifecycle={identity.permissions.includes("asset_vulnerabilities.write")}
        canCreateRemediationTask={identity.permissions.includes("remediation.write")}
      />
    );
  }

  const resolvedAssetVulnerabilityId = await resolveAssetVulnerabilityIdFromRoute(
    id
  );

  if (!resolvedAssetVulnerabilityId) {
    notFound();
  }

  redirect(`/vulnerabilities/${resolvedAssetVulnerabilityId}`);
}
