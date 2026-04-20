"use client";

import { Server, Monitor, Bug, AlertTriangle, Bell, Clock, Eye, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { SeverityBadge, PriorityBadge, SlaBadge, StatusBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import { PageHeader } from "@/components/shared/page-header";
import { assets, vulnerabilities, alerts, scanImports, remediationTasks, severityDistribution, exposureTrend, remediationTrend } from "@/lib/mock-data";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

export default function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const totalAssets = assets.length;
  const atmGabCount = assets.filter(a => a.type === "ATM" || a.type === "GAB").length;
  const totalVulns = vulnerabilities.reduce((s, v) => s + v.affectedAssetsCount, 0);
  const criticalVulns = vulnerabilities.filter(v => v.severity === "CRITICAL").length;
  const openAlerts = alerts.filter(a => a.status === "New" || a.status === "Acknowledged").length;
  const overdueRem = remediationTasks.filter(r => r.slaStatus === "Overdue").length;

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
        show: true, position: "center" as const, formatter: () => `{a|${(totalVulns / 1000).toFixed(1)}k}\n{b|Total}`,
        rich: { a: { fontSize: 28, fontWeight: "bold" as const, color: textDark, lineHeight: 36 }, b: { fontSize: 13, color: textLight, lineHeight: 20 } }
      },
      data: severityDistribution.map(s => ({ value: s.value, name: s.name, itemStyle: { color: s.color } })),
    }],
  };

  const trendOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: textLight, fontSize: 12 }, itemWidth: 16, itemHeight: 3, itemGap: 16 },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: "category" as const, data: exposureTrend.map(d => d.month), axisLine: { lineStyle: { color: bgBorder } }, axisLabel: { color: textLight, fontSize: 12 } },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [
      { name: "Critical", type: "line" as const, smooth: true, data: exposureTrend.map(d => d.critical), lineStyle: { color: "#EF4444", width: 2.5 }, itemStyle: { color: "#EF4444" }, areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.1)" }, { offset: 1, color: "rgba(239,68,68,0)" }] } }, symbol: "circle", symbolSize: 6 },
      { name: "High", type: "line" as const, smooth: true, data: exposureTrend.map(d => d.high), lineStyle: { color: "#F59E0B", width: 2 }, itemStyle: { color: "#F59E0B" }, symbol: "circle", symbolSize: 4, showSymbol: false },
      { name: "Medium", type: "line" as const, smooth: true, data: exposureTrend.map(d => d.medium), lineStyle: { color: "#3B82F6", width: 2 }, itemStyle: { color: "#3B82F6" }, symbol: "circle", symbolSize: 4, showSymbol: false },
    ],
  };

  const remediationBarOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: textLight, fontSize: 12 }, itemWidth: 10, itemHeight: 10, itemGap: 16 },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: "category" as const, data: remediationTrend.map(d => d.month), axisLine: { lineStyle: { color: bgBorder } }, axisLabel: { color: textLight, fontSize: 12 } },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [
      { name: "Opened", type: "bar" as const, data: remediationTrend.map(d => d.opened), itemStyle: { color: "#0C5CAB", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
      { name: "Closed", type: "bar" as const, data: remediationTrend.map(d => d.closed), itemStyle: { color: "#3B82F6", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
      { name: "Overdue", type: "bar" as const, data: remediationTrend.map(d => d.overdue), itemStyle: { color: "#F59E0B", borderRadius: [6, 6, 0, 0] }, barWidth: 16 },
    ],
  };

  const topRiskyAtms = [...assets].filter(a => a.type === "ATM" || a.type === "GAB").sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const latestAlerts = alerts.slice(0, 5);
  const topVulns = [...vulnerabilities].sort((a, b) => b.cvssScore - a.cvssScore).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Security Dashboard"
        description="Real-time overview of your ATM/GAB vulnerability posture"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-6 animate-stagger">
        <KpiCard hero label="Total Assets" value={totalAssets} change="+2 vs last month" changeType="neutral" icon={<Server className="h-5 w-5" />} />
        <KpiCard label="ATM / GAB" value={atmGabCount} change="98% coverage" changeType="positive" icon={<Monitor className="h-5 w-5" />} />
        <KpiCard label="Vulnerabilities" value={`${(totalVulns / 1000).toFixed(1)}k`} change="+12% vs last month" changeType="negative" icon={<Bug className="h-5 w-5" />} />
        <KpiCard label="Critical CVEs" value={criticalVulns} change="+2 new this week" changeType="negative" icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard label="Open Alerts" value={openAlerts} change="+3 from last week" changeType="negative" icon={<Bell className="h-5 w-5" />} />
        <KpiCard label="Overdue Tasks" value={overdueRem} change="SLA breach risk" changeType="negative" icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Severity Distribution</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-0.5">Across all monitored assets</p>
            </div>
          </div>
          <EChart option={severityDonutOption} height="280px" />
        </Card>
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Vulnerability Trends</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-0.5">6-month exposure trajectory</p>
            </div>
          </div>
          <EChart option={trendOption} height="280px" />
        </Card>
      </div>

      {/* Remediation Progress + Top Risky ATMs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Remediation Activity</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-0.5">Opened vs closed vs overdue</p>
            </div>
          </div>
          <EChart option={remediationBarOption} height="260px" />
        </Card>

        {/* Top Risky ATMs */}
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Top Risky ATM / GAB</h3>
            <Link href="/assets" className="text-xs text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] flex items-center gap-1 cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {topRiskyAtms.map((atm) => (
              <Link key={atm.id} href={`/assets/${atm.id}`} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer group border-b border-[#F3F4F6] dark:border-[#27272a] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
                    <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke={bgBorder} strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={atm.riskScore >= 80 ? "#EF4444" : atm.riskScore >= 60 ? "#F59E0B" : "#3B82F6"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${atm.riskScore * 0.942} 100`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1A1A2E] dark:text-[#fafafa]">{atm.riskScore}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] group-hover:text-[#0C5CAB] dark:group-hover:text-[#60A5FA] transition-colors">{atm.name}</p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{atm.model} · {atm.branch}</p>
                  </div>
                </div>
                <SeverityBadge severity={atm.maxSeverity} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Latest Alerts */}
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Latest Alerts</h3>
            <Link href="/alerts" className="text-xs text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] flex items-center gap-1 cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {latestAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer border-b border-[#F3F4F6] dark:border-[#27272a] last:border-0">
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${alert.severity === "CRITICAL" ? "bg-red-500" : alert.severity === "HIGH" ? "bg-orange-500" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] truncate">{alert.title}</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{alert.relatedAsset} · {alert.createdAt}</p>
                </div>
                <StatusBadge status={alert.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Latest Scan Imports */}
        <Card className="p-6 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Latest Scan Imports</h3>
            <Link href="/scan-import" className="text-xs text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] flex items-center gap-1 cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {scanImports.slice(0, 5).map((imp) => (
              <Link key={imp.id} href={`/scan-import/${imp.id}`} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer border-b border-[#F3F4F6] dark:border-[#27272a] last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] text-xs font-bold shrink-0">
                    {imp.scannerSource.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] truncate">{imp.name}</p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{imp.importDate} · {imp.findingsFound} findings</p>
                  </div>
                </div>
                <StatusBadge status={imp.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Most Prioritized Vulnerabilities Table */}
      <Card className="rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">Active Vulnerabilities</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DBEAFE] dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] text-[10px] font-bold px-1.5">
              {vulnerabilities.length}
            </span>
          </div>
          <Link href="/vulnerabilities" className="text-xs text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] flex items-center gap-1 cursor-pointer">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="dark-table-head">
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">CVE</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Severity</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Biz Priority</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Affected ATMs</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">First Seen</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">SLA Due</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topVulns.map((vuln) => (
                <tr key={vuln.id} className="dark-table-row">
                  <td className="py-3 px-4">
                    <Link href={`/vulnerabilities/${vuln.id}`} className="text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] cursor-pointer">{vuln.cveId}</Link>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] truncate max-w-[200px]">{vuln.title}</p>
                  </td>
                  <td className="py-3 px-4"><SeverityBadge severity={vuln.severity} score={vuln.cvssScore} /></td>
                  <td className="py-3 px-4"><PriorityBadge priority={vuln.businessPriority} /></td>
                  <td className="py-3 px-4 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{vuln.affectedAssetsCount}</td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">{vuln.firstSeen}</td>
                  <td className="py-3 px-4"><SlaBadge status={vuln.slaStatus} /></td>
                  <td className="py-3 px-4 text-center">
                    <Link href={`/vulnerabilities/${vuln.id}`} className="cursor-pointer">
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 cursor-pointer text-[#9CA3AF] dark:text-[#64748B] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
