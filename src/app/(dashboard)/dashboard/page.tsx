import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { Filter, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth";
import { startServerTiming } from "@/lib/observability/timing";
import {
  getDashboardActivityData,
  getDashboardRiskData,
  getDashboardSummaryData,
} from "@/lib/services/dashboard";
import {
  DashboardSummarySection,
  DashboardRiskSection,
  DashboardActivitySection,
  DashboardSummaryFallback,
  DashboardTwoCardFallback,
} from "./dashboard-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function DashboardSectionUnavailable({
  title,
  description = "This section took too long to respond. The rest of the dashboard is still available.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm opacity-80">{description}</p>
    </Card>
  );
}

async function DashboardSummaryLoader() {
  let data = null;

  try {
    data = await getDashboardSummaryData();
  } catch {
    return <DashboardSectionUnavailable title="Dashboard summary unavailable" />;
  }

  return <DashboardSummarySection data={data} />;
}

async function DashboardRiskLoader() {
  let data = null;

  try {
    data = await getDashboardRiskData();
  } catch {
    return <DashboardSectionUnavailable title="Risk widgets unavailable" />;
  }

  return <DashboardRiskSection data={data} />;
}

async function DashboardActivityLoader() {
  let data = null;

  try {
    data = await getDashboardActivityData();
  } catch {
    return <DashboardSectionUnavailable title="Activity widgets unavailable" />;
  }

  return <DashboardActivitySection data={data} />;
}

export default async function DashboardPage() {
  noStore();
  const timing = startServerTiming("route.dashboard.page");
  await requirePermission("dashboard.view");
  timing.end({ streamed: true });

  return (
    <div>
      <PageHeader
        title="Security Dashboard"
        description="Live operational overview of your ATM/GAB vulnerability posture"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              className="gradient-accent border-0 text-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
              asChild
            >
              <Link href="/vulnerabilities" prefetch={false}>
                <ShieldAlert className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10 font-semibold tracking-wide">
                  Review Critical Exposure
                </span>
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-in-out" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
            >
              <Link href="/scan-import" prefetch={false}>
                <Upload className="mr-2 h-4 w-4" /> Import Scan
              </Link>
            </Button>
          </div>
        }
      />

      <Suspense fallback={<DashboardSummaryFallback />}>
        <DashboardSummaryLoader />
      </Suspense>
      <Suspense fallback={<DashboardTwoCardFallback />}>
        <DashboardRiskLoader />
      </Suspense>
      <Suspense fallback={<DashboardTwoCardFallback />}>
        <DashboardActivityLoader />
      </Suspense>

      <div className="hidden items-center gap-2 rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B7280] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#94A3B8] xl:flex">
        <Filter className="h-3.5 w-3.5" />
        Dashboard widgets refresh after data-changing actions.
      </div>
    </div>
  );
}
