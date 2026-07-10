"use client";

import type { ReactNode } from "react";
import { ClipboardCheck, Upload } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { EChart } from "@/components/shared/echart";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import {
  formatDashboardCount,
  formatDashboardTooltip,
  type DashboardTooltipItem,
} from "@/lib/dashboard-count";
import type { DashboardSummaryData } from "@/lib/services/dashboard";

type TooltipItem = DashboardTooltipItem & {
  dataIndex?: number;
  name?: string;
};

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#94A3B8]">
          {description}
        </p>
      </div>
      {children}
    </Card>
  );
}

function tooltipItems(value: unknown): TooltipItem[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is TooltipItem => Boolean(item && typeof item === "object")
    );
  }

  return value && typeof value === "object" ? [value as TooltipItem] : [];
}

function formatScanDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRemediationMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function DashboardCharts({ data }: { data: DashboardSummaryData }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";
  const totalVulnerabilities = formatDashboardCount(
    data.totals.totalVulnerabilities
  );
  const axisCount = (value: string | number) =>
    formatDashboardCount(Number(value)).display;

  const severityAriaLabel = `Severity distribution. Total ${totalVulnerabilities.exact} vulnerabilities. ${data.severityDistribution
    .map(
      (segment) =>
        `${segment.name}: ${formatDashboardCount(segment.value).exact}`
    )
    .join(". ")}.`;
  const trendAriaLabel = `Vulnerability trend from ${data.exposureTrend.length} Nessus scans. ${data.exposureTrend
    .map(
      (point) =>
        `${formatScanDate(point.scanDate)}: ${
          formatDashboardCount(point.critical).exact
        } critical, ${formatDashboardCount(point.high).exact} high, ${
          formatDashboardCount(point.medium).exact
        } medium, ${formatDashboardCount(point.low).exact} low, ${
          formatDashboardCount(point.newFindings).exact
        } new, ${formatDashboardCount(point.fixedFindings).exact} fixed, ${
          formatDashboardCount(point.reopenedFindings).exact
        } reopened`
    )
    .join(". ")}.`;
  const remediationAriaLabel = `Remediation activity. ${data.remediationTrend
    .map(
      (point) =>
        `${formatRemediationMonth(point.periodStart)}: ${
          formatDashboardCount(point.opened).exact
        } opened, ${formatDashboardCount(point.closed).exact} completed or closed, ${
          formatDashboardCount(point.overdue).exact
        } overdue`
    )
    .join(". ")}.`;

  const severityDonutOption = {
    tooltip: {
      trigger: "item" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark },
      formatter: (value: unknown) => {
        const item = tooltipItems(value)[0];
        return formatDashboardTooltip(item?.name ?? "Vulnerabilities", {
          marker: item?.marker,
          seriesName: "Count",
          value: item?.value,
        });
      },
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: { color: textLight, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
    },
    series: [
      {
        name: "Vulnerabilities",
        type: "pie" as const,
        radius: ["55%", "80%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: bgCard, borderWidth: 3 },
        label: {
          show: true,
          position: "center" as const,
          formatter: () => `{a|${totalVulnerabilities.display}}\n{b|Total}`,
          rich: {
            a: {
              fontSize: 28,
              fontWeight: "bold" as const,
              color: textDark,
              lineHeight: 36,
            },
            b: { fontSize: 13, color: textLight, lineHeight: 20 },
          },
        },
        data: data.severityDistribution.map((segment) => ({
          value: segment.value,
          name: segment.name,
          itemStyle: { color: segment.color },
        })),
      },
    ],
  };

  const trendSeries = [
    { name: "Critical", key: "critical" as const, color: "#EF4444" },
    { name: "High", key: "high" as const, color: "#F59E0B" },
    { name: "Medium", key: "medium" as const, color: "#3B82F6" },
    { name: "Low", key: "low" as const, color: "#10B981" },
    { name: "New", key: "newFindings" as const, color: "#8B5CF6", dashed: true },
    { name: "Fixed", key: "fixedFindings" as const, color: "#22C55E", dashed: true },
    {
      name: "Reopened",
      key: "reopenedFindings" as const,
      color: "#F97316",
      dashed: true,
    },
  ].map((series, index) => ({
    name: series.name,
    type: "line" as const,
    smooth: true,
    data: data.exposureTrend.map((point) => point[series.key]),
    lineStyle: {
      color: series.color,
      width: index === 0 ? 2.5 : 2,
      type: series.dashed ? ("dashed" as const) : ("solid" as const),
    },
    itemStyle: { color: series.color },
    areaStyle:
      index === 0
        ? {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(239,68,68,0.1)" },
                { offset: 1, color: "rgba(239,68,68,0)" },
              ],
            },
          }
        : undefined,
    symbol: "circle",
    symbolSize: index === 0 ? 6 : 4,
    showSymbol: index === 0,
  }));

  const trendOption = {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark, fontSize: 12 },
      formatter: (value: unknown) => {
        const items = tooltipItems(value);
        const point = data.exposureTrend[items[0]?.dataIndex ?? -1];
        const heading = point
          ? `${formatScanDate(point.scanDate)} — ${point.scanName}`
          : "Nessus scan";
        return formatDashboardTooltip(heading, items);
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: textLight, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 3,
      itemGap: 12,
    },
    grid: { top: 20, right: 20, bottom: 58, left: 50 },
    xAxis: {
      type: "category" as const,
      data: data.exposureTrend.map((point) => point.month),
      axisLine: { lineStyle: { color: bgBorder } },
      axisLabel: { color: textLight, fontSize: 12 },
    },
    yAxis: {
      type: "value" as const,
      splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } },
      axisLabel: { color: textLight, fontSize: 12, formatter: axisCount },
    },
    series: trendSeries,
  };

  const remediationBarOption = {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark, fontSize: 12 },
      formatter: (value: unknown) => {
        const items = tooltipItems(value);
        const point = data.remediationTrend[items[0]?.dataIndex ?? -1];
        return formatDashboardTooltip(
          point ? formatRemediationMonth(point.periodStart) : "Remediation",
          items
        );
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: textLight, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
    },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: "category" as const,
      data: data.remediationTrend.map((point) => point.month),
      axisLine: { lineStyle: { color: bgBorder } },
      axisLabel: { color: textLight, fontSize: 12 },
    },
    yAxis: {
      type: "value" as const,
      splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } },
      axisLabel: { color: textLight, fontSize: 12, formatter: axisCount },
    },
    series: [
      {
        name: "Opened",
        type: "bar" as const,
        data: data.remediationTrend.map((point) => point.opened),
        itemStyle: { color: "#0C5CAB", borderRadius: [6, 6, 0, 0] },
        barWidth: 16,
      },
      {
        name: "Completed / closed",
        type: "bar" as const,
        data: data.remediationTrend.map((point) => point.closed),
        itemStyle: { color: "#3B82F6", borderRadius: [6, 6, 0, 0] },
        barWidth: 16,
      },
      {
        name: "Overdue",
        type: "bar" as const,
        data: data.remediationTrend.map((point) => point.overdue),
        itemStyle: { color: "#F59E0B", borderRadius: [6, 6, 0, 0] },
        barWidth: 16,
      },
    ],
  };

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          title="Severity Distribution"
          description="Across all monitored assets"
        >
          <EChart
            option={severityDonutOption}
            height="280px"
            ariaLabel={severityAriaLabel}
          />
        </SectionCard>

        <SectionCard
          title="Vulnerability Trends"
          description="Last six completed Nessus scan imports"
        >
          {data.exposureTrend.length > 0 ? (
            <EChart
              option={trendOption}
              height="280px"
              ariaLabel={trendAriaLabel}
            />
          ) : (
            <div className="flex h-[280px] items-center [&>div]:w-full">
              <EmptyState
                compact
                icon={Upload}
                title="No Nessus scan history"
                description="Import a completed Nessus scan to build the exposure trend."
              />
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard
          title="Remediation Activity"
          description="Opened vs completed or closed vs overdue"
        >
          {data.remediationTrend.length > 0 ? (
            <EChart
              option={remediationBarOption}
              height="260px"
              ariaLabel={remediationAriaLabel}
            />
          ) : (
            <div className="flex h-[260px] items-center [&>div]:w-full">
              <EmptyState
                compact
                icon={ClipboardCheck}
                title="No remediation history"
                description="Create remediation tasks to build the activity trend."
              />
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
