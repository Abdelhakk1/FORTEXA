"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, Columns, Download, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { SeverityBadge, PriorityBadge, SlaBadge, KevBadge, StatusBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useTheme } from "@/components/theme-provider";
import { downloadCsv } from "@/lib/download";
import type { RemediationCampaign, Vulnerability } from "@/lib/types";
import type { VulnerabilityOverviewData } from "@/lib/services/vulnerabilities";

type ViewMode = "campaign" | "cve" | "asset";
type SortDirection = "asc" | "desc";
type CveSortKey = "recommendedFixOrder" | "cveId" | "severity" | "businessPriority" | "affectedAssetsCount" | "firstSeen" | "slaDue";
type AssetSortKey = "name" | "maxSeverity" | "vulnerabilityCount" | "riskScore" | "lastScanDate";

const PAGE_SIZE = 8;
const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
const priorityRank = { P1: 5, P2: 4, P3: 3, P4: 2, P5: 1 };
const priorityLabels = {
  P1: "Fix first",
  P2: "Accelerated",
  P3: "Planned",
  P4: "Routine",
  P5: "Routine",
} as const;

function isCampaignRow(
  row: RemediationCampaign | Vulnerability
): row is RemediationCampaign {
  return "representativeVulnerabilityId" in row;
}

function slaDisplayRank(status: string) {
  if (status === "Overdue") return -2;
  if (status === "Due today") return -1;

  const dueInMatch = status.match(/^Due in (\d+) days?$/);
  if (dueInMatch?.[1]) {
    return Number.parseInt(dueInMatch[1], 10);
  }

  if (status === "On Track") return 1_000;
  if (status === "No SLA") return 1_001;
  return 1_002;
}

function campaignDisplayTitle(title: string) {
  return title.replace(/\s+remediation campaign$/i, "").trim();
}

function pluralize(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function CampaignMetricChip({
  children,
  emphasis = false,
}: {
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
        emphasis
          ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0C5CAB] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#93C5FD]"
          : "border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#111827] dark:text-[#E5E7EB]"
      }`}
    >
      {children}
    </span>
  );
}

const defaultCveColumns = {
  severity: true,
  priority: true,
  affectedAssetsCount: true,
  kev: true,
  firstSeen: true,
  slaDue: true,
  actions: true,
};

const defaultAssetColumns = {
  type: true,
  region: true,
  exposure: true,
  vulnerabilityCount: true,
  maxSeverity: true,
  priority: true,
  riskScore: true,
  actions: true,
};

export default function VulnerabilitiesPageClient({
  data,
}: {
  data: VulnerabilityOverviewData;
}) {
  const {
    assets,
    remediationCampaigns,
    vulnerabilities,
    severityDistribution,
    topVulnerableModels,
  } = data;
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [kevFilter, setKevFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [exposureFilter, setExposureFilter] = useState("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("campaign");
  const [page, setPage] = useState(1);
  const [cveSort, setCveSort] = useState<{ key: CveSortKey; direction: SortDirection }>({
    key: "recommendedFixOrder",
    direction: "desc",
  });
  const [assetSort, setAssetSort] = useState<{ key: AssetSortKey; direction: SortDirection }>({
    key: "riskScore",
    direction: "desc",
  });
  const [visibleCveColumns, setVisibleCveColumns] = useState(defaultCveColumns);
  const [visibleAssetColumns, setVisibleAssetColumns] = useState(defaultAssetColumns);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";
  const slaFilterOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...remediationCampaigns.map((campaign) => campaign.slaStatus),
          ...vulnerabilities.map((vulnerability) => vulnerability.slaStatus),
        ])
      )
        .sort((left, right) => slaDisplayRank(left) - slaDisplayRank(right)),
    [remediationCampaigns, vulnerabilities]
  );

  const filteredCampaigns = useMemo(() => {
    return remediationCampaigns.filter((campaign) => {
      if (
        search &&
        !campaign.title.toLowerCase().includes(search.toLowerCase()) &&
        !campaign.groupedCvesText.toLowerCase().includes(search.toLowerCase()) &&
        !campaign.affectedAssetCodes.join(" ").toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      if (severityFilter !== "all" && campaign.severity !== severityFilter) return false;
      if (priorityFilter !== "all" && campaign.businessPriority !== priorityFilter) return false;
      if (kevFilter !== "all") {
        if (kevFilter === "yes" && !campaign.hasCisaKevSource) return false;
        if (kevFilter === "no" && campaign.hasCisaKevSource) return false;
      }
      if (slaFilter !== "all" && campaign.slaStatus !== slaFilter) return false;
      return true;
    });
  }, [kevFilter, priorityFilter, remediationCampaigns, search, severityFilter, slaFilter]);

  const filteredCves = useMemo(() => {
    return vulnerabilities.filter((vulnerability) => {
      if (
        search &&
        !vulnerability.cveId.toLowerCase().includes(search.toLowerCase()) &&
        !vulnerability.title.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      if (severityFilter !== "all" && vulnerability.severity !== severityFilter) return false;
      if (priorityFilter !== "all" && vulnerability.businessPriority !== priorityFilter) return false;
      if (kevFilter !== "all") {
        if (kevFilter === "yes" && !vulnerability.hasCisaKevSource) return false;
        if (kevFilter === "no" && vulnerability.hasCisaKevSource) return false;
      }
      if (slaFilter !== "all" && vulnerability.slaStatus !== slaFilter) return false;
      return true;
    });
  }, [kevFilter, priorityFilter, search, severityFilter, slaFilter, vulnerabilities]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (
        search &&
        !asset.name.toLowerCase().includes(search.toLowerCase()) &&
        !asset.id.toLowerCase().includes(search.toLowerCase()) &&
        !asset.branch.toLowerCase().includes(search.toLowerCase()) &&
        !asset.model.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      if (severityFilter !== "all" && asset.maxSeverity !== severityFilter) return false;
      if (priorityFilter !== "all" && asset.contextualPriority !== priorityFilter) return false;
      if (exposureFilter !== "all" && asset.gabExposureType !== exposureFilter) return false;
      if (assetStatusFilter !== "all" && asset.status !== assetStatusFilter) return false;
      return true;
    });
  }, [assetStatusFilter, assets, exposureFilter, priorityFilter, search, severityFilter]);

  const sortedCves = useMemo(() => {
    return [...filteredCves].sort((left, right) => {
      const direction = cveSort.direction === "asc" ? 1 : -1;

      switch (cveSort.key) {
        case "recommendedFixOrder":
          return ((left.recommendedFixOrder ?? 0) - (right.recommendedFixOrder ?? 0)) * direction;
        case "cveId":
          return left.cveId.localeCompare(right.cveId) * direction;
        case "severity":
          return (severityRank[left.severity] - severityRank[right.severity]) * direction;
        case "businessPriority":
          return (priorityRank[left.businessPriority] - priorityRank[right.businessPriority]) * direction;
        case "affectedAssetsCount":
          return (left.affectedAssetsCount - right.affectedAssetsCount) * direction;
        case "firstSeen":
          return (new Date(left.firstSeen).getTime() - new Date(right.firstSeen).getTime()) * direction;
        case "slaDue":
          return (new Date(left.slaDue).getTime() - new Date(right.slaDue).getTime()) * direction;
      }
    });
  }, [filteredCves, cveSort]);

  const sortedCampaigns = useMemo(() => {
    return [...filteredCampaigns].sort((left, right) => {
      const direction = cveSort.direction === "asc" ? 1 : -1;

      switch (cveSort.key) {
        case "recommendedFixOrder":
          return ((left.recommendedFixOrder ?? 0) - (right.recommendedFixOrder ?? 0)) * direction;
        case "cveId":
          return left.title.localeCompare(right.title) * direction;
        case "severity":
          return (severityRank[left.severity] - severityRank[right.severity]) * direction;
        case "businessPriority":
          return (priorityRank[left.businessPriority] - priorityRank[right.businessPriority]) * direction;
        case "affectedAssetsCount":
          return (left.affectedAssetsCount - right.affectedAssetsCount) * direction;
        case "firstSeen":
          return (new Date(left.firstSeen).getTime() - new Date(right.firstSeen).getTime()) * direction;
        case "slaDue":
          return (new Date(left.slaDue).getTime() - new Date(right.slaDue).getTime()) * direction;
      }
    });
  }, [filteredCampaigns, cveSort]);

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((left, right) => {
      const direction = assetSort.direction === "asc" ? 1 : -1;

      switch (assetSort.key) {
        case "name":
          return left.name.localeCompare(right.name) * direction;
        case "maxSeverity":
          return (severityRank[left.maxSeverity] - severityRank[right.maxSeverity]) * direction;
        case "vulnerabilityCount":
          return (left.vulnerabilityCount - right.vulnerabilityCount) * direction;
        case "riskScore":
          return (left.riskScore - right.riskScore) * direction;
        case "lastScanDate":
          return (new Date(left.lastScanDate).getTime() - new Date(right.lastScanDate).getTime()) * direction;
      }
    });
  }, [filteredAssets, assetSort]);

  const activeQueueItems =
    viewMode === "campaign"
      ? sortedCampaigns.length
      : viewMode === "cve"
        ? sortedCves.length
        : sortedAssets.length;
  const totalPages = Math.max(1, Math.ceil(activeQueueItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedCampaigns = sortedCampaigns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginatedCves = sortedCves.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginatedAssets = sortedAssets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginatedQueueRows =
    viewMode === "campaign" ? paginatedCampaigns : paginatedCves;

  const clearFilters = () => {
    setSearch("");
    setSeverityFilter("all");
    setPriorityFilter("all");
    setKevFilter("all");
    setSlaFilter("all");
    setExposureFilter("all");
    setAssetStatusFilter("all");
    setPage(1);
  };

  const donutOption = {
    tooltip: { trigger: "item" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark } },
    legend: { bottom: 0, left: "center", textStyle: { color: textLight, fontSize: 11 }, itemWidth: 8, itemHeight: 8, itemGap: 12 },
    series: [{
      type: "pie" as const,
      radius: ["50%", "78%"],
      center: ["50%", "42%"],
      itemStyle: { borderRadius: 5, borderColor: bgCard, borderWidth: 3 },
      label: {
        show: true,
        position: "center" as const,
        formatter: `{a|${vulnerabilities.length}}\n{b|CVEs}`,
        rich: {
          a: { fontSize: 24, fontWeight: "bold" as const, color: textDark, lineHeight: 32 },
          b: { fontSize: 12, color: textLight, lineHeight: 18 },
        },
      },
      data: severityDistribution.map((segment) => ({ value: segment.value, name: segment.name, itemStyle: { color: segment.color } })),
    }],
  };

  const barOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    grid: { top: 10, right: 20, bottom: 10, left: 130, containLabel: false },
    xAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 11 } },
    yAxis: { type: "category" as const, data: topVulnerableModels.map((model) => model.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [{
      type: "bar" as const,
      data: topVulnerableModels.map((model) => model.value).reverse(),
      itemStyle: {
        color: (params: { dataIndex: number }) => ["#10B981", "#3B82F6", "#F59E0B", "#E8533F", "#EF4444"][params.dataIndex] || "#E8533F",
        borderRadius: [0, 4, 4, 0],
      },
      barWidth: 20,
    }],
  };

  const toggleCveSort = (key: CveSortKey) => {
    setCveSort((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === "desc" ? "asc" : "desc",
    }));
  };

  const toggleAssetSort = (key: AssetSortKey) => {
    setAssetSort((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === "desc" ? "asc" : "desc",
    }));
  };

  const exportCurrentView = () => {
    if (viewMode === "campaign") {
      downloadCsv({
        filename: "fortexa-remediation-campaigns.csv",
        columns: [
          { key: "title", label: "Campaign" },
          { key: "groupedCvesText", label: "CVEs" },
          { key: "severity", label: "Highest Severity" },
          { key: "businessPriority", label: "Fix Bucket" },
          { key: "rankScore", label: "Rank Score" },
          { key: "affectedAssetsCount", label: "GABs" },
          { key: "exposureSummary", label: "Exposure Summary" },
          { key: "campaignRationale", label: "Remediation Rationale" },
          { key: "slaDue", label: "SLA Due" },
        ],
        rows: sortedCampaigns,
      });
      return;
    }

    if (viewMode === "cve") {
      downloadCsv({
        filename: "fortexa-vulnerabilities-by-cve.csv",
        columns: [
          { key: "cveId", label: "CVE" },
          { key: "title", label: "Title" },
          { key: "severity", label: "Severity" },
          { key: "businessPriority", label: "Fix Bucket" },
          { key: "affectedAssetsCount", label: "Affected Assets" },
          { key: "exploitMaturity", label: "Exploit Maturity" },
          { key: "epssScore", label: "EPSS Score" },
          { key: "tieBreakReason", label: "Fix Order Rationale" },
          { key: "firstSeen", label: "First Seen" },
          { key: "slaDue", label: "SLA Due" },
        ],
        rows: sortedCves,
      });
      return;
    }

    downloadCsv({
      filename: "fortexa-vulnerabilities-by-asset.csv",
      columns: [
        { key: "id", label: "Asset ID" },
        { key: "name", label: "Asset" },
        { key: "type", label: "Type" },
        { key: "branch", label: "Coverage Area" },
        { key: "region", label: "Region" },
        { key: "gabExposureType", label: "GAB Exposure" },
        { key: "cidtSensitivity", label: "GAB Sensitivity" },
        { key: "vulnerabilityCount", label: "Vulnerability Count" },
        { key: "maxSeverity", label: "Max Severity" },
        { key: "contextualPriority", label: "Priority" },
        { key: "riskScore", label: "Risk Score" },
      ],
      rows: sortedAssets.map((asset) => ({
        ...asset,
        cidtSensitivity: asset.cidt.sensitivity,
      })),
    });
  };

  const activeFilterCount = [
    severityFilter,
    priorityFilter,
    viewMode === "asset" ? exposureFilter : kevFilter,
    viewMode === "asset" ? assetStatusFilter : slaFilter,
  ].filter((value) => value !== "all").length + (search ? 1 : 0);

  const cveSortState = (key: CveSortKey) => cveSort.key === key ? cveSort.direction : undefined;
  const assetSortState = (key: AssetSortKey) => assetSort.key === key ? assetSort.direction : undefined;
  const isRecommendedFixOrder =
    viewMode !== "asset" &&
    cveSort.key === "recommendedFixOrder" &&
    cveSort.direction === "desc";

  const renderSortableHeader = (
    label: string,
    onClick: () => void,
    sortState?: SortDirection
  ) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 whitespace-nowrap text-left"
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3.5 w-3.5 ${sortState ? "text-[#0C5CAB] dark:text-[#60A5FA]" : "text-[#9CA3AF] dark:text-[#64748B]"}`} />
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Vulnerability Management"
        description={`${remediationCampaigns.length} remediation campaigns from ${vulnerabilities.length} tracked asset-vulnerability records`}
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-[#E9ECEF] dark:border-[#27272a]">
              <button
                type="button"
                aria-pressed={viewMode === "campaign"}
                onClick={() => {
                  setViewMode("campaign");
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "campaign" ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]"}`}
              >
                By Campaign
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "cve"}
                onClick={() => {
                  setViewMode("cve");
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "cve" ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]"}`}
              >
                Individual CVEs
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "asset"}
                onClick={() => {
                  setViewMode("asset");
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "asset" ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]"}`}
              >
                By Asset
              </button>
            </div>
            <Button onClick={exportCurrentView} className="gradient-accent border-0 text-white">
              <Download className="mr-2 h-4 w-4" /> Export Report
            </Button>
          </div>
        }
      />

      <Card className="mb-5 border border-[#E9ECEF] bg-white p-4 dark:border-[#27272a] dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder={
              viewMode === "campaign"
                ? "Search campaign, CVE, GAB..."
                : viewMode === "cve"
                  ? "Search CVE, title..."
                  : "Search GAB, coverage area, model..."
            }
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          />
          <Select
            value={severityFilter}
            onValueChange={(value) => {
              setSeverityFilter(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">Severity: All</SelectItem>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => (
                <SelectItem key={severity} value={severity} className="cursor-pointer">{severity}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(value) => {
              setPriorityFilter(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[170px]"><SelectValue placeholder="Fix bucket" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">Fix bucket: All</SelectItem>
              {(["P1", "P2", "P3", "P4"] as const).map((priority) => (
                <SelectItem key={priority} value={priority} className="cursor-pointer">{priorityLabels[priority]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode !== "asset" ? (
            <>
              <Select
                value={kevFilter}
                onValueChange={(value) => {
                  setKevFilter(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[180px]"><SelectValue placeholder="Exploitable (KEV)" /></SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  <SelectItem value="all" className="cursor-pointer">Exploitable (KEV): All</SelectItem>
                  <SelectItem value="yes" className="cursor-pointer">Yes (KEV)</SelectItem>
                  <SelectItem value="no" className="cursor-pointer">No</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={slaFilter}
                onValueChange={(value) => {
                  setSlaFilter(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[150px]"><SelectValue placeholder="SLA Status" /></SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  <SelectItem value="all" className="cursor-pointer">SLA Status: All</SelectItem>
                  {slaFilterOptions.map((status) => (
                    <SelectItem key={status} value={status} className="cursor-pointer">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Select
                value={exposureFilter}
                onValueChange={(value) => {
                  setExposureFilter(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[220px]"><SelectValue placeholder="GAB Exposure" /></SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  <SelectItem value="all" className="cursor-pointer">GAB Exposure: All</SelectItem>
                  {["Unknown", "Indoor GAB", "Outdoor GAB"].map((exposure) => (
                    <SelectItem key={exposure} value={exposure} className="cursor-pointer">{exposure}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assetStatusFilter}
                onValueChange={(value) => {
                  setAssetStatusFilter(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[150px]"><SelectValue placeholder="Asset Status" /></SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  <SelectItem value="all" className="cursor-pointer">Asset Status: All</SelectItem>
                  {["Active", "Maintenance", "Inactive"].map((status) => (
                    <SelectItem key={status} value={status} className="cursor-pointer">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <button onClick={clearFilters} className="text-sm font-medium text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
            Clear
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280] dark:border-[#27272a] dark:text-[#94A3B8]">
          <span>
            {viewMode === "campaign"
              ? filteredCampaigns.length
              : viewMode === "cve"
                ? filteredCves.length
                : filteredAssets.length} {viewMode === "campaign" ? "campaigns" : viewMode === "cve" ? "records" : "assets"} in this view
          </span>
          <span>
            {isRecommendedFixOrder
              ? "Sorted by recommended fix order"
              : activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                : "No active filters"}
          </span>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#141419]">
          <h3 className="mb-0.5 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Severity Distribution</h3>
          <p className="mb-2 text-xs text-[#6B7280] dark:text-[#94A3B8]">Breakdown of active vulnerabilities</p>
          <EChart option={donutOption} height="240px" />
        </Card>
        <Card className="border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#141419]">
          <h3 className="mb-0.5 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Top Vulnerable Models</h3>
          <p className="mb-2 text-xs text-[#6B7280] dark:text-[#94A3B8]">Findings by ATM model</p>
          <EChart option={barOption} height="240px" />
        </Card>
      </div>

      {activeQueueItems === 0 ? (
        <Card className="border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <EmptyState
            title={
              viewMode === "campaign"
                ? "No remediation campaigns match these filters"
                : viewMode === "cve"
                  ? "No vulnerabilities match these filters"
                  : "No assets match these filters"
            }
            description="Clear the current filters or widen the search terms to get back to the active vulnerability view."
            actionLabel="Clear filters"
            onAction={clearFilters}
            compact
          />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E9ECEF] px-5 py-4 dark:border-[#27272a]">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                {viewMode === "campaign" ? "Remediation Campaign Queue" : viewMode === "cve" ? "Individual Vulnerability Records" : "Assets With Active Exposure"}
              </h3>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DBEAFE] px-1.5 text-[10px] font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
                {viewMode === "campaign" ? filteredCampaigns.length : viewMode === "cve" ? filteredCves.length : filteredAssets.length}
              </span>
            </div>
            {viewMode !== "asset" ? (
              <p className="hidden text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] sm:block">
                Fix #1 is the recommended first remediation {viewMode === "campaign" ? "campaign" : "record"}
              </p>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]">
                  <Columns className="mr-1 h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                {viewMode !== "asset" ? (
                  <>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.severity} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, severity: Boolean(checked) }))}>Severity</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.priority} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, priority: Boolean(checked) }))}>Fix bucket</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.affectedAssetsCount} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, affectedAssetsCount: Boolean(checked) }))}>Affected Assets</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.kev} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, kev: Boolean(checked) }))}>KEV</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.firstSeen} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, firstSeen: Boolean(checked) }))}>First Seen</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleCveColumns.slaDue} onCheckedChange={(checked) => setVisibleCveColumns((current) => ({ ...current, slaDue: Boolean(checked) }))}>SLA Due</DropdownMenuCheckboxItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.type} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, type: Boolean(checked) }))}>Type</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.region} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, region: Boolean(checked) }))}>Coverage / Region</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.exposure} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, exposure: Boolean(checked) }))}>GAB Exposure</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.vulnerabilityCount} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, vulnerabilityCount: Boolean(checked) }))}>Vulnerability Count</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.maxSeverity} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, maxSeverity: Boolean(checked) }))}>Max Severity</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.priority} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, priority: Boolean(checked) }))}>Priority</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={visibleAssetColumns.riskScore} onCheckedChange={(checked) => setVisibleAssetColumns((current) => ({ ...current, riskScore: Boolean(checked) }))}>Risk Score</DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {viewMode !== "asset"
              ? paginatedQueueRows.map((vulnerability, index) => {
                const isCampaign = isCampaignRow(vulnerability);
                const fixRank = isRecommendedFixOrder
                  ? (currentPage - 1) * PAGE_SIZE + index + 1
                  : vulnerability.fixRank;
                const href = isCampaign
                  ? `/vulnerabilities/${vulnerability.representativeVulnerabilityId}`
                  : `/vulnerabilities/${vulnerability.id}`;
                const rowTitle = isCampaign
                  ? campaignDisplayTitle(vulnerability.title)
                  : vulnerability.cveId;
                const rowSubtitle = isCampaign
                  ? vulnerability.campaignRationale
                  : vulnerability.title;

                return (
                <div key={vulnerability.id} className={`rounded-xl border p-4 ${isCampaign && fixRank === 1 ? "border-[#BFDBFE] bg-[#EFF6FF]/70 dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D]/70" : "border-[#E9ECEF] dark:border-[#27272a]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {fixRank ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${fixRank === 1 ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#EFF6FF] text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]"}`}>
                            Fix #{fixRank}
                          </span>
                        ) : null}
                        <Link href={href} prefetch={false} className="text-sm font-semibold text-[#0C5CAB] dark:text-[#60A5FA]">
                          {rowTitle}
                        </Link>
                      </div>
                      <p className="mt-1 text-sm text-[#1A1A2E] dark:text-[#fafafa]">{rowSubtitle}</p>
                      {!isCampaign && vulnerability.tieBreakReason ? (
                        <p className="mt-1 text-xs leading-5 text-[#6B7280] dark:text-[#94A3B8]">
                          {vulnerability.tieBreakReason}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {isCampaign
                          ? `${vulnerability.cveCount} CVE${vulnerability.cveCount === 1 ? "" : "s"} · ${vulnerability.affectedAssetsCount} GAB${vulnerability.affectedAssetsCount === 1 ? "" : "s"} · ${vulnerability.exposureSummary}`
                          : `${vulnerability.gabExposureType ?? "GAB exposure unknown"} · ${vulnerability.rankBucket ?? "Routine"} · score ${vulnerability.rankScore ?? vulnerability.riskScore ?? "pending"}`}
                      </p>
                    </div>
                    <Link href={href} prefetch={false}>
                      <Button variant="ghost" size="sm" aria-label={`Open ${rowTitle}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  {isCampaign ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <CampaignMetricChip emphasis>{pluralize(vulnerability.cveCount, "CVE")}</CampaignMetricChip>
                      <CampaignMetricChip>{pluralize(vulnerability.affectedAssetsCount, "GAB")}</CampaignMetricChip>
                      <CampaignMetricChip>{vulnerability.exposureSummary}</CampaignMetricChip>
                      <CampaignMetricChip>Score {vulnerability.rankScore}</CampaignMetricChip>
                      {vulnerability.hasCisaKevSource ? <CampaignMetricChip>KEV</CampaignMetricChip> : null}
                    </div>
                  ) : null}
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
              );
              })
              : paginatedAssets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-[#E9ECEF] p-4 dark:border-[#27272a]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[#6B7280] dark:text-[#64748B]">{asset.id}</p>
                      <Link href={`/assets/${asset.id}`} prefetch={false} className="mt-1 block text-sm font-semibold text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">
                        {asset.name}
                      </Link>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                    </div>
                    <Link href={`/assets/${asset.id}`} prefetch={false}>
                      <Button variant="ghost" size="sm" aria-label={`Open ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">GAB Exposure</p>
                      <p className="text-[#1A1A2E] dark:text-[#fafafa]">{asset.gabExposureType}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Status</p>
                      <StatusBadge status={asset.status} />
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Max Severity</p>
                      <SeverityBadge severity={asset.maxSeverity} />
                    </div>
                    <div>
                      <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Risk Score</p>
                      <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.riskScore}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto w-full">
              {viewMode !== "asset" ? (
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                      <th
                        aria-sort={cveSortState("cveId") === "asc" ? "ascending" : cveSortState("cveId") === "desc" ? "descending" : "none"}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                      >
                        {renderSortableHeader(viewMode === "campaign" ? "Campaign" : "CVE", () => toggleCveSort("cveId"), cveSortState("cveId"))}
                      </th>
                      {visibleCveColumns.severity && (
                        <th
                          aria-sort={cveSortState("severity") === "asc" ? "ascending" : cveSortState("severity") === "desc" ? "descending" : "none"}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("Severity", () => toggleCveSort("severity"), cveSortState("severity"))}
                        </th>
                      )}
                      {visibleCveColumns.priority && (
                        <th
                          aria-sort={cveSortState("businessPriority") === "asc" ? "ascending" : cveSortState("businessPriority") === "desc" ? "descending" : "none"}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader(viewMode === "campaign" ? "Fix" : "Fix bucket", () => toggleCveSort("businessPriority"), cveSortState("businessPriority"))}
                        </th>
                      )}
                      {visibleCveColumns.affectedAssetsCount && (
                        <th
                          aria-sort={cveSortState("affectedAssetsCount") === "asc" ? "ascending" : cveSortState("affectedAssetsCount") === "desc" ? "descending" : "none"}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("Assets", () => toggleCveSort("affectedAssetsCount"), cveSortState("affectedAssetsCount"))}
                        </th>
                      )}
                      {visibleCveColumns.kev && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">KEV</th>}
                      {visibleCveColumns.firstSeen && viewMode !== "campaign" && (
                        <th
                          aria-sort={cveSortState("firstSeen") === "asc" ? "ascending" : cveSortState("firstSeen") === "desc" ? "descending" : "none"}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("First Seen", () => toggleCveSort("firstSeen"), cveSortState("firstSeen"))}
                        </th>
                      )}
                      {visibleCveColumns.slaDue && (
                        <th
                          aria-sort={cveSortState("slaDue") === "asc" ? "ascending" : cveSortState("slaDue") === "desc" ? "descending" : "none"}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("SLA Due", () => toggleCveSort("slaDue"), cveSortState("slaDue"))}
                        </th>
                      )}
                      {visibleCveColumns.actions && <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Open</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQueueRows.map((vulnerability, index) => {
                      const isCampaign = isCampaignRow(vulnerability);
                      const fixRank = isRecommendedFixOrder
                        ? (currentPage - 1) * PAGE_SIZE + index + 1
                        : vulnerability.fixRank;
                      const href = isCampaign
                        ? `/vulnerabilities/${vulnerability.representativeVulnerabilityId}`
                        : `/vulnerabilities/${vulnerability.id}`;
                      const rowTitle = isCampaign
                        ? campaignDisplayTitle(vulnerability.title)
                        : vulnerability.cveId;
                      const rowSubtitle = isCampaign
                        ? vulnerability.campaignRationale
                        : vulnerability.title;

                      return (
                      <tr key={vulnerability.id} className={`dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] ${isCampaign && fixRank === 1 ? "bg-[#EFF6FF]/70 dark:bg-[#0A1A2D]/55" : "hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50"}`}>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {fixRank ? (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${fixRank === 1 ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#EFF6FF] text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]"}`}>
                                Fix #{fixRank}
                              </span>
                            ) : null}
                            <Link href={href} prefetch={false} className="font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">{rowTitle}</Link>
                          </div>
                          <p className={`${isCampaign ? "max-w-[520px]" : "max-w-[300px] truncate"} text-xs leading-5 text-[#6B7280] dark:text-[#64748B]`}>{rowSubtitle}</p>
                          <p className={`mt-0.5 ${isCampaign ? "max-w-[520px]" : "max-w-[300px] truncate"} text-[11px] leading-5 text-[#6B7280] dark:text-[#94A3B8]`}>
                            {isCampaign
                              ? `${vulnerability.groupedCvesText}`
                              : `${vulnerability.gabExposureType ?? "GAB exposure unknown"} · ${vulnerability.rankBucket ?? "Routine"} · score ${vulnerability.rankScore ?? vulnerability.riskScore ?? "pending"}`}
                          </p>
                          {isCampaign ? (
                            <div className="mt-2 flex max-w-[560px] flex-wrap gap-1.5">
                              <CampaignMetricChip emphasis>{pluralize(vulnerability.cveCount, "CVE")}</CampaignMetricChip>
                              <CampaignMetricChip>{pluralize(vulnerability.affectedAssetsCount, "GAB")}</CampaignMetricChip>
                              <CampaignMetricChip>{vulnerability.exposureSummary}</CampaignMetricChip>
                              <CampaignMetricChip>Score {vulnerability.rankScore}</CampaignMetricChip>
                            </div>
                          ) : vulnerability.tieBreakReason ? (
                            <p className="mt-0.5 max-w-[300px] truncate text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
                              {vulnerability.tieBreakReason}
                            </p>
                          ) : null}
                        </td>
                        {visibleCveColumns.severity && <td className="px-4 py-3"><SeverityBadge severity={vulnerability.severity} score={vulnerability.cvssScore} /></td>}
                        {visibleCveColumns.priority && <td className="px-4 py-3"><PriorityBadge priority={vulnerability.businessPriority} /></td>}
                        {visibleCveColumns.affectedAssetsCount && (
                          <td className="px-4 py-3 font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            {isCampaign ? (
                              <div className="space-y-1 whitespace-nowrap">
                                <p>{vulnerability.affectedAssetsCount} GAB{vulnerability.affectedAssetsCount === 1 ? "" : "s"}</p>
                                <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#94A3B8]">{vulnerability.findingCount} finding{vulnerability.findingCount === 1 ? "" : "s"}</p>
                              </div>
                            ) : (
                              vulnerability.affectedAssetsCount
                            )}
                          </td>
                        )}
                        {visibleCveColumns.kev && <td className="px-4 py-3"><KevBadge maturity={vulnerability.exploitMaturity} /></td>}
                        {visibleCveColumns.firstSeen && viewMode !== "campaign" && <td className="whitespace-nowrap px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{vulnerability.firstSeen}</td>}
                        {visibleCveColumns.slaDue && <td className="whitespace-nowrap px-4 py-3"><SlaBadge status={vulnerability.slaStatus} /></td>}
                        {visibleCveColumns.actions && (
                          <td className="px-4 py-3">
                            <Link href={href} prefetch={false}>
                              <Button variant={isCampaign ? "outline" : "ghost"} size="sm" aria-label={`Open ${rowTitle}`} className={isCampaign ? "h-9 whitespace-nowrap border-[#E9ECEF] bg-white px-3 text-xs font-semibold text-[#0C5CAB] hover:bg-[#EFF6FF] dark:border-[#27272a] dark:bg-[#111827] dark:text-[#93C5FD] dark:hover:bg-[#1a1a22]" : "h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"}>
                                {isCampaign ? (
                                  <>
                                    Open <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                  </>
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </Link>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                      <th
                        aria-sort={assetSortState("name") === "asc" ? "ascending" : assetSortState("name") === "desc" ? "descending" : "none"}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                      >
                        {renderSortableHeader("Asset", () => toggleAssetSort("name"), assetSortState("name"))}
                      </th>
                      {visibleAssetColumns.type && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Type</th>}
                      {visibleAssetColumns.region && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Coverage / Region</th>}
                      {visibleAssetColumns.exposure && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">GAB Exposure</th>}
                      {visibleAssetColumns.vulnerabilityCount && (
                        <th
                          aria-sort={assetSortState("vulnerabilityCount") === "asc" ? "ascending" : assetSortState("vulnerabilityCount") === "desc" ? "descending" : "none"}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("Vulns", () => toggleAssetSort("vulnerabilityCount"), assetSortState("vulnerabilityCount"))}
                        </th>
                      )}
                      {visibleAssetColumns.maxSeverity && (
                        <th
                          aria-sort={assetSortState("maxSeverity") === "asc" ? "ascending" : assetSortState("maxSeverity") === "desc" ? "descending" : "none"}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("Max Severity", () => toggleAssetSort("maxSeverity"), assetSortState("maxSeverity"))}
                        </th>
                      )}
                      {visibleAssetColumns.priority && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Priority</th>}
                      {visibleAssetColumns.riskScore && (
                        <th
                          aria-sort={assetSortState("riskScore") === "asc" ? "ascending" : assetSortState("riskScore") === "desc" ? "descending" : "none"}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                        >
                          {renderSortableHeader("Risk Score", () => toggleAssetSort("riskScore"), assetSortState("riskScore"))}
                        </th>
                      )}
                      {visibleAssetColumns.actions && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssets.map((asset) => (
                      <tr key={asset.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                        <td className="px-4 py-3">
                          <Link href={`/assets/${asset.id}`} prefetch={false} className="font-semibold text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">{asset.name}</Link>
                          <p className="text-xs text-[#6B7280] dark:text-[#64748B]">{asset.id} · {asset.model}</p>
                        </td>
                        {visibleAssetColumns.type && <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{asset.type}</td>}
                        {visibleAssetColumns.region && (
                          <td className="px-4 py-3">
                            <p className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.region}</p>
                          </td>
                        )}
                        {visibleAssetColumns.exposure && (
                          <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">
                            {asset.gabExposureType}
                            <p className="mt-0.5 text-[11px] text-[#94A3B8]">CIDT {asset.cidt.sensitivity}</p>
                          </td>
                        )}
                        {visibleAssetColumns.vulnerabilityCount && <td className="px-4 py-3 font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount}</td>}
                        {visibleAssetColumns.maxSeverity && <td className="px-4 py-3"><SeverityBadge severity={asset.maxSeverity} /></td>}
                        {visibleAssetColumns.priority && <td className="px-4 py-3"><PriorityBadge priority={asset.contextualPriority} /></td>}
                        {visibleAssetColumns.riskScore && <td className="px-4 py-3 font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.riskScore}</td>}
                        {visibleAssetColumns.actions && (
                          <td className="px-4 py-3">
                            <Link href={`/assets/${asset.id}`} prefetch={false}>
                              <Button variant="ghost" size="sm" aria-label={`Open ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"><Eye className="h-4 w-4" /></Button>
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={
              viewMode === "campaign"
                ? filteredCampaigns.length
                : viewMode === "cve"
                  ? filteredCves.length
                  : filteredAssets.length
            }
            pageSize={PAGE_SIZE}
            itemLabel={viewMode === "campaign" ? "campaigns" : viewMode === "cve" ? "records" : "assets"}
            onPageChange={setPage}
          />
        </Card>
      )}
    </div>
  );
}
