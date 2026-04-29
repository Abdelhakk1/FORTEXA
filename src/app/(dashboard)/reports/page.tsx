import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { listReports } from "@/lib/services/reports";
import { ReportsPageClient } from "./reports-page-client";

export default async function ReportsPage() {
  await requirePermission("reports.read");
  const activeOrganization = await requireActiveOrganization();
  const data = await listReports(activeOrganization.organization.id);

  return <ReportsPageClient data={data} />;
}
