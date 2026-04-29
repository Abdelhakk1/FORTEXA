import { notFound } from "next/navigation";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { getScanImportDetail } from "@/lib/services/scan-imports";
import ImportDetailClient from "./scan-import-detail-client";

type Params = Promise<{ id: string }>;

export default async function ScanImportDetailPage({
  params,
}: {
  params: Params;
}) {
  await requirePermission("scan_imports.read");
  const activeOrganization = await requireActiveOrganization();
  const { id } = await params;
  const data = await getScanImportDetail(activeOrganization.organization.id, id);

  if (!data) {
    notFound();
  }

  return <ImportDetailClient data={data} />;
}
