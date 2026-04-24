"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import { EChart } from "@/components/shared/echart";
import { Card } from "@/components/ui/card";
import type { DashboardSummaryData } from "@/lib/services/dashboard";

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

export function DashboardCharts({ data }: { data: DashboardSummaryData }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";

  const severityDonutOption = {
    tooltip: {
      trigger: "item" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark },
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
        type: "pie" as const,
        radius: ["55%", "80%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: bgCard, borderWidth: 3 },
        label: {
          show: true,
          position: "center" as const,
          formatter: () =>
            `{a|${(data.totals.totalVulnerabilities / 1000).toFixed(1)}k}\n{b|Total}`,
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

  const trendOption = {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark, fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { color: textLight, fontSize: 12 },
      itemWidth: 16,
      itemHeight: 3,
      itemGap: 16,
    },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: "category" as const,
      data: data.exposureTrend.map((point) => point.month),
      axisLine: { lineStyle: { color: bgBorder } },
      axisLabel: { color: textLight, fontSize: 12 },
    },
    yAxis: {
      type: "value" as const,
      splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } },
      axisLabel: { color: textLight, fontSize: 12 },
    },
    series: [
      {
        name: "Critical",
        type: "line" as const,
        smooth: true,
        data: data.exposureTrend.map((point) => point.critical),
        lineStyle: { color: "#EF4444", width: 2.5 },
        itemStyle: { color: "#EF4444" },
        areaStyle: {
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
        },
        symbol: "circle",
        symbolSize: 6,
      },
      {
        name: "High",
        type: "line" as const,
        smooth: true,
        data: data.exposureTrend.map((point) => point.high),
        lineStyle: { color: "#F59E0B", width: 2 },
        itemStyle: { color: "#F59E0B" },
        symbol: "circle",
        symbolSize: 4,
        showSymbol: false,
      },
      {
        name: "Medium",
        type: "line" as const,
        smooth: true,
        data: data.exposureTrend.map((point) => point.medium),
        lineStyle: { color: "#3B82F6", width: 2 },
        itemStyle: { color: "#3B82F6" },
        symbol: "circle",
        symbolSize: 4,
        showSymbol: false,
      },
    ],
  };

  const remediationBarOption = {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: bgCard,
      borderColor: bgBorder,
      borderWidth: 1,
      textStyle: { color: textDark, fontSize: 12 },
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
      axisLabel: { color: textLight, fontSize: 12 },
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
        name: "Closed",
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
          <EChart option={severityDonutOption} height="280px" />
        </SectionCard>

        <SectionCard
          title="Vulnerability Trends"
          description="6-month exposure trajectory"
        >
          <EChart option={trendOption} height="280px" />
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard
          title="Remediation Activity"
          description="Opened vs closed vs overdue"
        >
          <EChart option={remediationBarOption} height="260px" />
        </SectionCard>
      </div>
    </>
  );
}
