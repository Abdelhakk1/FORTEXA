import { requireAuth } from "@/lib/auth";
import { listRemediationTasks } from "@/lib/services/remediation";
import { RemediationPageClient } from "./remediation-page-client";

export default async function RemediationPage() {
  await requireAuth();
  const data = await listRemediationTasks();

  return <RemediationPageClient data={data} />;
}
