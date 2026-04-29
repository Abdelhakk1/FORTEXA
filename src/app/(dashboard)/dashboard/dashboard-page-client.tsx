"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bug,
  CheckCircle2,
  Clock,
  Database,
  Monitor,
  Server,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { seedSampleAssetsAction } from "@/actions/onboarding";
import type {
  DashboardActivityData,
  DashboardRiskData,
  DashboardSummaryData,
} from "@/lib/services/dashboard";

const DashboardCharts = dynamic(
  () => import("./dashboard-charts").then((module) => module.DashboardCharts),
  {
    ssr: false,
    loading: () => <DashboardChartsFallback />,
  }
);

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function DashboardSummarySection({
  data,
}: {
  data: DashboardSummaryData;
}) {
  const router = useRouter();
  const [showCharts, setShowCharts] = useState(false);
  const [isLoadingSample, startSampleLoad] = useTransition();
  const [sampleMessage, setSampleMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowCharts(true);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          hero
          label="Total Assets"
          value={data.totals.totalAssets}
          change="+0 vs last month"
          changeType="neutral"
          icon={<Server className="h-5 w-5" />}
        />
        <KpiCard
          label="ATM / GAB"
          value={data.totals.atmGabCount}
          change="Live inventory"
          changeType="positive"
          icon={<Monitor className="h-5 w-5" />}
        />
        <KpiCard
          label="Vulnerabilities"
          value={`${(data.totals.totalVulnerabilities / 1000).toFixed(1)}k`}
          change="Current open exposure"
          changeType={data.totals.totalVulnerabilities > 0 ? "negative" : "neutral"}
          icon={<Bug className="h-5 w-5" />}
        />
        <KpiCard
          label="Critical CVEs"
          value={data.totals.criticalVulnerabilities}
          change="Requires review"
          changeType={data.totals.criticalVulnerabilities > 0 ? "negative" : "neutral"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="Open Alerts"
          value={data.totals.openAlerts}
          change="Operational queue"
          changeType={data.totals.openAlerts > 0 ? "negative" : "positive"}
          icon={<Bell className="h-5 w-5" />}
        />
        <KpiCard
          label="Overdue Tasks"
          value={data.totals.overdueTasks}
          change="SLA breach risk"
          changeType={data.totals.overdueTasks > 0 ? "negative" : "positive"}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {!data.hasOperationalData ? (
        <div className="mb-6">
          {sampleMessage && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {sampleMessage}
            </div>
          )}
          <EmptyState
            icon={Upload}
            title="No Fortexa operating data yet"
            description="This dashboard is connected to the live backend and has no assets or scan imports for this organization. Start with scanner evidence, sample data, or CSV inventory."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="gradient-accent border-0 text-white"
                >
                  <Link href="/scan-import" prefetch={false}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Nessus
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoadingSample}
                  onClick={() => {
                    setSampleMessage(null);
                    startSampleLoad(async () => {
                      const result = await seedSampleAssetsAction();
                      if (!result.ok) {
                        setSampleMessage(result.message);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  <Database className="mr-2 h-4 w-4" />
                  {isLoadingSample ? "Loading..." : "Use sample data"}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/assets" prefetch={false}>
                    <Server className="mr-2 h-4 w-4" />
                    Import CSV assets
                  </Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : showCharts ? (
        <DashboardCharts data={data} />
      ) : (
        <DashboardChartsFallback />
      )}
    </>
  );
}

export function DashboardRiskSection({ data }: { data: DashboardRiskData }) {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          title="Top Risky ATM / GAB"
          description="Highest exposure scores in the fleet"
          action={
            <Link
              href="/assets"
              prefetch={false}
              className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="space-y-1">
            {data.topRiskyAssets.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CheckCircle2}
                  title="No risky assets"
                  description="Real backend data is live, and there are currently no risky assets to rank."
                />
              </div>
            ) : (
              data.topRiskyAssets.map((asset) => (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}`}
                  prefetch={false}
                  className="group flex items-center justify-between rounded-xl border-b border-[#F3F4F6] px-3 py-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
                      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="#E9ECEF"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={
                            asset.riskScore >= 80
                              ? "#EF4444"
                              : asset.riskScore >= 60
                                ? "#F59E0B"
                                : "#3B82F6"
                          }
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${asset.riskScore * 0.942} 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1A1A2E] dark:text-[#fafafa]">
                        {asset.riskScore}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E] transition-colors group-hover:text-[#0C5CAB] dark:text-[#fafafa] dark:group-hover:text-[#60A5FA]">
                        {asset.name}
                      </p>
                      <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">
                        {asset.model} · {asset.branch}
                      </p>
                    </div>
                  </div>
                  <SeverityBadge severity={asset.maxSeverity} />
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Active Vulnerabilities"
          description="Prioritized operational backlog"
        >
          {data.prioritizedVulnerabilities.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No active vulnerabilities"
              description="Real backend data is connected, and there are currently no prioritized vulnerability records to show."
            />
          ) : (
            <div className="space-y-3">
              {data.prioritizedVulnerabilities.map((vulnerability) => (
                <Link
                  key={vulnerability.id}
                  href={`/vulnerabilities/${vulnerability.id}`}
                  prefetch={false}
                  className="flex items-start justify-between gap-4 rounded-xl border border-[#F3F4F6] px-4 py-3 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                      {vulnerability.cveId}
                    </p>
                    <p className="line-clamp-2 text-sm text-[#6B7280] dark:text-[#94A3B8]">
                      {vulnerability.title}
                    </p>
                    <p className="mt-1 text-xs text-[#9CA3AF] dark:text-[#64748B]">
                      {vulnerability.affectedAssetsCount} affected assets
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <SeverityBadge severity={vulnerability.severity} />
                    <PriorityBadge priority={vulnerability.businessPriority} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

export function DashboardActivitySection({
  data,
}: {
  data: DashboardActivityData;
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <SectionCard
        title="Latest Alerts"
        description="Most recent detection and workflow signals"
        action={
          <Link
            href="/alerts"
            prefetch={false}
            className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="space-y-1">
          {data.latestAlerts.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Bell}
                title="No recent alerts"
                description="Everything is quiet. The live alert queue is currently empty."
              />
            </div>
          ) : (
            data.latestAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-xl border-b border-[#F3F4F6] p-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0"
              >
                <div
                  className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    alert.severity === "CRITICAL"
                      ? "bg-red-500"
                      : alert.severity === "HIGH"
                        ? "bg-orange-500"
                        : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {alert.title}
                  </p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">
                    {alert.relatedAsset} · {alert.createdAt}
                  </p>
                </div>
                <StatusBadge status={alert.status} />
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Latest Scan Imports"
        description="Recent ingest activity and normalized findings"
        action={
          <Link
            href="/scan-import"
            prefetch={false}
            className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="space-y-1">
          {data.latestScanImports.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Upload}
                title="No recent imports"
                description="Upload a scanner file to start building live import history."
              />
            </div>
          ) : (
            data.latestScanImports.map((scanImport) => (
              <Link
                key={scanImport.id}
                href={`/scan-import/${scanImport.id}`}
                prefetch={false}
                className="flex items-center justify-between rounded-xl border-b border-[#F3F4F6] p-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-xs font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
                    {scanImport.scannerSource.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                      {scanImport.name}
                    </p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">
                      {scanImport.importDate} · {scanImport.findingsFound} findings
                    </p>
                  </div>
                </div>
                <StatusBadge status={scanImport.status} />
              </Link>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function DashboardSummaryFallback() {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
      <Skeleton className="mb-6 h-[300px] rounded-2xl" />
    </>
  );
}

export function DashboardChartsFallback() {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
      <Skeleton className="mb-6 h-[300px] rounded-2xl" />
    </>
  );
}

export function DashboardTwoCardFallback() {
  return (
    <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Skeleton className="h-[320px] rounded-2xl" />
      <Skeleton className="h-[320px] rounded-2xl" />
    </div>
  );
}
