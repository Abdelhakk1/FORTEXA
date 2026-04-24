import { requirePermission } from "@/lib/auth";
import { listReports } from "@/lib/services/reports";
import { ReportsPageClient } from "./reports-page-client";

export default async function ReportsPage() {
  await requirePermission("reports.read");
  const data = await listReports();

  return <ReportsPageClient data={data} />;
}
