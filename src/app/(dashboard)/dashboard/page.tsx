import { requireAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/services/dashboard";
import { DashboardPageClient } from "./dashboard-page-client";

export default async function DashboardPage() {
  await requireAuth();
  const data = await getDashboardData();

  return <DashboardPageClient data={data} />;
}
