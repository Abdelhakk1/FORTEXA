import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { listScanImports } from "@/lib/services/scan-imports";
import { startServerTiming } from "@/lib/observability/timing";
import { ScanImportPageClient } from "./scan-import-page-client";

export default async function ScanImportPage() {
  const timing = startServerTiming("route.scanImport.page");
  await requirePermission("scan_imports.read");
  const activeOrganization = await requireActiveOrganization();
  const data = await listScanImports(activeOrganization.organization.id);
  timing.end({ total: data.imports.total });

  return <ScanImportPageClient data={data} />;
}
