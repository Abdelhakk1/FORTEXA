"use client";

import Link from "next/link";
import { Server, Monitor, Bug, AlertTriangle, Bell, Clock, Eye, ArrowRight, Upload, ShieldAlert, Filter, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { SeverityBadge, PriorityBadge, SlaBadge, StatusBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import { PageHeader } from "@/components/shared/page-header";
import { useTheme } from "@/components/theme-provider";
import type { getDashboardData } from "@/lib/services/dashboard";

interface DashboardPageClientProps {
  data: Awaited<ReturnType<typeof getDashboardData>>;
}

export function DashboardPageClient({ data }: DashboardPageClientProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";

  const severityDonutOption = {
    tooltip: { trigger: "item" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark } },
    legend: { bottom: 0, left: "center", textStyle: { color: textLight, fontSize: 12 }, itemWidth: 10, itemHeight: 10, itemGap: 16 },
    series: [{
      type: "pie" as const,
      radius: ["55%", "80%"],
      center: ["50%", "45%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: bgCard, borderWidth: 3 },
      label: {
        show: true,
        position: "center" as const,
        formatter: () => `{a|${(data.totals.totalVulnerabilities / 1000).toFixed(1)}k}\n{b|Total}`,
        rich: {
          a: { fontSize: 28, fontWeight: "bold" as const, color: textDark, lineHeight: 36 },
          b: { fontSize: 13, color: textLight, lineHeight: 20 },
        },
      },
      data: data.severityDistribution.map((segment) => ({ value: segment.value, name: segment.name, itemStyle: { color: segment.color } })),
    }],
  };

  const trendOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: textLight, fontSize: 12 }, itemWidth: 16, itemHeight: 3, itemGap: 16 },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: "category" as const, data: data.exposureTrend.map((point) => point.month), axisLine: { lineStyle: { color: bgBorder } }, axisLabel: { color: textLight, fontSize: 12 } },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [
      { name: "Critical", type: "line" as const, smooth: true, data: data.exposureTrend.map((point) => point.critical), lineStyle: { color: "#EF4444", width: 2.5 }, itemStyle: { color: "#EF4444" }, areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.1)" }, { offset: 1, color: "rgba(239,68,68,0)" }] } }, symbol: "circle", symbolSize: 6 },
      { name: "High", type: "line" as const, smooth: true, data: data.exposureTrend.map((point) => point.high), lineStyle: { color: "#F59E0B", width: 2 }, itemStyle: { color: "#F59E0B" }, symbol: "circle", symbolSize: 4, showSymbol: false },
      { name: "Medium", type: "line" as const, smooth: true, data: data.exposureTrend.map((point) => point.medium), lineStyle: { color: "#3B82F6", width: 2 }, itemStyle: { color: "#3B82F6" }, symbol: "circle", symbolSize: 4, showSymbol: false },
    ],
  };

  const remediationBarOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: textLight, fontSize: 12 }, itemWidth: 10, itemHeight: 10, itemGap: 16 },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: "category" as const, data: data.remediationTrend.map((point) => point.month), axisLine: { lineStyle: { color: bgBorder } }, axisLabel: { color: textLight, fontSize: 12 } },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [
      { name: "Opened", type: "bar" as const, data: data.remediationTrend.map((point) => point.opened), itemStyle: { color: "#0C5CAB", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
      { name: "Closed", type: "bar" as const, data: data.remediationTrend.map((point) => point.closed), itemStyle: { color: "#3B82F6", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
      { name: "Overdue", type: "bar" as const, data: data.remediationTrend.map((point) => point.overdue), itemStyle: { color: "#F59E0B", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
    ],
  };

  return (
    <div>
      <PageHeader
        title="Security Dashboard"
        description="Real-time overview of your ATM/GAB vulnerability posture"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="gradient-accent border-0 text-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group" asChild>
              <Link href="/vulnerabilities">
                <ShieldAlert className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10 font-semibold tracking-wide">Review Critical Exposure</span>
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-in-out" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
            >
              <Link href="/scan-import"><Upload className="mr-2 h-4 w-4" /> Import Scan</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-5 animate-stagger md:grid-cols-3 lg:grid-cols-6">
        <KpiCard hero label="Total Assets" value={data.totals.totalAssets} change="+0 vs last month" changeType="neutral" icon={<Server className="h-5 w-5" />} />
        <KpiCard label="ATM / GAB" value={data.totals.atmGabCount} change="Live inventory" changeType="positive" icon={<Monitor className="h-5 w-5" />} />
        <KpiCard label="Vulnerabilities" value={`${(data.totals.totalVulnerabilities / 1000).toFixed(1)}k`} change="Current open exposure" changeType={data.totals.totalVulnerabilities > 0 ? "negative" : "neutral"} icon={<Bug className="h-5 w-5" />} />
        <KpiCard label="Critical CVEs" value={data.totals.criticalVulnerabilities} change="Requires review" changeType={data.totals.criticalVulnerabilities > 0 ? "negative" : "neutral"} icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard label="Open Alerts" value={data.totals.openAlerts} change="Operational queue" changeType={data.totals.openAlerts > 0 ? "negative" : "positive"} icon={<Bell className="h-5 w-5" />} />
        <KpiCard label="Overdue Tasks" value={data.totals.overdueTasks} change="SLA breach risk" changeType={data.totals.overdueTasks > 0 ? "negative" : "positive"} icon={<Clock className="h-5 w-5" />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Severity Distribution</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">Across all monitored assets</p>
            </div>
          </div>
          <EChart option={severityDonutOption} height="280px" />
        </Card>

        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Vulnerability Trends</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">6-month exposure trajectory</p>
            </div>
          </div>
          <EChart option={trendOption} height="280px" />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Remediation Activity</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">Opened vs closed vs overdue</p>
            </div>
          </div>
          <EChart option={remediationBarOption} height="260px" />
        </Card>

        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Top Risky ATM / GAB</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">Highest exposure scores in the fleet</p>
            </div>
            <Link href="/assets" className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {data.topRiskyAssets.length === 0 ? (
              <div className="mt-4"><EmptyState icon={CheckCircle2} title="No risky assets" description="Real backend data is live, and there are currently no risky assets to rank." /></div>
            ) : (
              data.topRiskyAssets.map((asset) => (
                <Link key={asset.id} href={`/assets/${asset.id}`} className="group flex items-center justify-between rounded-xl border-b border-[#F3F4F6] px-3 py-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
                      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke={bgBorder} strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={asset.riskScore >= 80 ? "#EF4444" : asset.riskScore >= 60 ? "#F59E0B" : "#3B82F6"}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${asset.riskScore * 0.942} 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1A1A2E] dark:text-[#fafafa]">{asset.riskScore}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E] transition-colors group-hover:text-[#0C5CAB] dark:text-[#fafafa] dark:group-hover:text-[#60A5FA]">{asset.name}</p>
                      <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{asset.model} · {asset.branch}</p>
                    </div>
                  </div>
                  <SeverityBadge severity={asset.maxSeverity} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Latest Alerts</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">Most recent detection and workflow signals</p>
            </div>
            <Link href="/alerts" className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {data.latestAlerts.length === 0 ? (
              <div className="mt-4"><EmptyState icon={Bell} title="No recent alerts" description="Everything is quiet. The live alert queue is currently empty." /></div>
            ) : (
              data.latestAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-xl border-b border-[#F3F4F6] p-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${alert.severity === "CRITICAL" ? "bg-red-500" : alert.severity === "HIGH" ? "bg-orange-500" : "bg-amber-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{alert.title}</p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{alert.relatedAsset} · {alert.createdAt}</p>
                  </div>
                  <StatusBadge status={alert.status} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Latest Scan Imports</h3>
              <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">Recent ingest activity and normalized findings</p>
            </div>
            <Link href="/scan-import" className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {data.latestScanImports.length === 0 ? (
              <div className="mt-4"><EmptyState icon={Upload} title="No recent imports" description="Upload a scanner file to start building live import history." /></div>
            ) : (
              data.latestScanImports.map((scanImport) => (
                <Link key={scanImport.id} href={`/scan-import/${scanImport.id}`} className="flex items-center justify-between rounded-xl border-b border-[#F3F4F6] p-2.5 transition-colors hover:bg-[#EFF6FF] dark:border-[#27272a] dark:hover:bg-[#1a1a22] last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-xs font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
                      {scanImport.scannerSource.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanImport.name}</p>
                      <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{scanImport.importDate} · {scanImport.findingsFound} findings</p>
                    </div>
                  </div>
                  <StatusBadge status={scanImport.status} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E9ECEF] px-6 py-4 dark:border-[#27272a] gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Active Vulnerabilities</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DBEAFE] px-1.5 text-[10px] font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
              {data.prioritizedVulnerabilities.length}
            </span>
            <div className="hidden sm:flex items-center gap-2 ml-4 px-2 py-1 rounded border border-[#E9ECEF] dark:border-[#27272a] bg-[#F8F9FA] dark:bg-[#1a1a22]">
              <Filter className="h-3 w-3 text-[#9CA3AF] dark:text-[#64748B]" />
              <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase">Status: Open</span>
            </div>
          </div>
          <Link href="/vulnerabilities" className="flex items-center gap-1 text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {data.prioritizedVulnerabilities.length === 0 ? (
          <div className="p-10">
            <EmptyState icon={CheckCircle2} title="No active vulnerabilities" description="Real backend data is connected, and there are currently no prioritized vulnerability records to show." />
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {data.prioritizedVulnerabilities.map((vulnerability) => (
                <div key={vulnerability.id} className="rounded-xl border border-[#E9ECEF] p-4 dark:border-[#27272a]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/vulnerabilities/${vulnerability.cveId}`} className="text-sm font-semibold text-[#0C5CAB] dark:text-[#60A5FA]">
                        {vulnerability.cveId}
                      </Link>
                      <p className="mt-1 text-sm text-[#1A1A2E] dark:text-[#fafafa]">{vulnerability.title}</p>
                    </div>
                    <Link href={`/vulnerabilities/${vulnerability.cveId}`}>
                      <Button variant="ghost" size="sm" aria-label={`Open ${vulnerability.cveId}`} className="h-9 w-9 p-0 text-[#9CA3AF] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#64748B] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Severity</p>
                      <SeverityBadge severity={vulnerability.severity} score={vulnerability.cvssScore} />
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Priority</p>
                      <PriorityBadge priority={vulnerability.businessPriority} />
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Affected</p>
                      <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{vulnerability.affectedAssetsCount} assets</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">SLA</p>
                      <SlaBadge status={vulnerability.slaStatus} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">CVE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Biz Priority</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Affected ATMs</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">First Seen</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">SLA Due</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.prioritizedVulnerabilities.map((vulnerability) => (
                      <tr key={vulnerability.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                        <td className="px-4 py-3">
                          <Link href={`/vulnerabilities/${vulnerability.cveId}`} className="font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">{vulnerability.cveId}</Link>
                          <p className="max-w-[200px] truncate text-xs text-[#9CA3AF] dark:text-[#64748B]">{vulnerability.title}</p>
                        </td>
                        <td className="px-4 py-3"><SeverityBadge severity={vulnerability.severity} score={vulnerability.cvssScore} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={vulnerability.businessPriority} /></td>
                        <td className="px-4 py-3 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{vulnerability.affectedAssetsCount}</td>
                        <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{vulnerability.firstSeen}</td>
                        <td className="px-4 py-3"><SlaBadge status={vulnerability.slaStatus} /></td>
                        <td className="px-4 py-3 text-center">
                          <Link href={`/vulnerabilities/${vulnerability.cveId}`}>
                            <Button variant="ghost" size="sm" aria-label={`Review ${vulnerability.cveId}`} className="gap-2 text-[#9CA3AF] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#64748B] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                              <span className="hidden lg:inline text-xs font-semibold">Review</span>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
