import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { startServerTiming } from "@/lib/observability/timing";
import { listRemediationTasks } from "@/lib/services/remediation";
import { RemediationPageClient } from "./remediation-page-client";

export default async function RemediationPage() {
  const timing = startServerTiming("route.remediation.page");
  const identity = await requirePermission("remediation.read");
  const activeOrganization = await requireActiveOrganization();
  const data = await listRemediationTasks(activeOrganization.organization.id);
  timing.end({ tasks: data.tasks.length });

  return (
    <RemediationPageClient
      data={data}
      viewerProfileId={identity.profile?.id ?? null}
      canWrite={identity.permissions.includes("remediation.write")}
      canUpdateStatus={identity.permissions.includes("remediation.update_status")}
    />
  );
}
