import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getAssetDetail } from "@/lib/services/assets";
import AssetDetailClient from "./asset-detail-client";

type Params = Promise<{ id: string }>;

export default async function AssetDetailPage({
  params,
}: {
  params: Params;
}) {
  await requirePermission("assets.read");
  const { id } = await params;
  const data = await getAssetDetail(id);

  if (!data) {
    notFound();
  }

  return <AssetDetailClient data={data} />;
}
