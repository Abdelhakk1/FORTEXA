import { requireAuth } from "@/lib/auth";
import { listScanImports } from "@/lib/services/scan-imports";
import { ScanImportPageClient } from "./scan-import-page-client";

export default async function ScanImportPage() {
  await requireAuth();
  const data = await listScanImports();

  return <ScanImportPageClient data={data} />;
}
