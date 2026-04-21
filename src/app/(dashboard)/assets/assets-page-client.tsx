"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, Eye, Server, Monitor, Globe, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SeverityBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { downloadCsv } from "@/lib/download";
import type { AssetsPageData } from "@/lib/services/assets";

interface AssetsPageClientProps {
  data: AssetsPageData;
  filters: {
    search: string;
    type: string;
    regionId: string;
    criticality: string;
    status: string;
    exposureLevel: string;
    page: number;
  };
}

export function AssetsPageClient({ data, filters }: AssetsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const activeFilters = useMemo(
    () =>
      [
        filters.type,
        filters.regionId,
        filters.criticality,
        filters.status,
        filters.exposureLevel,
      ].filter((value) => value !== "all").length + (filters.search ? 1 : 0),
    [filters]
  );

  const updateFilters = (next: Partial<AssetsPageClientProps["filters"]>) => {
    const params = new URLSearchParams();
    const merged = {
      ...filters,
      ...next,
    };

    if (merged.search) params.set("search", merged.search);
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.regionId !== "all") params.set("regionId", merged.regionId);
    if (merged.criticality !== "all") {
      params.set("criticality", merged.criticality);
    }
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.exposureLevel !== "all") {
      params.set("exposureLevel", merged.exposureLevel);
    }
    if ((merged.page ?? 1) > 1) params.set("page", String(merged.page));

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };

  const clearFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const handleExport = () => {
    downloadCsv({
      filename: "fortexa-assets.csv",
      columns: [
        { key: "id", label: "Asset ID" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "branch", label: "Branch" },
        { key: "region", label: "Region" },
        { key: "criticality", label: "Criticality" },
        { key: "exposureLevel", label: "Exposure" },
        { key: "vulnerabilityCount", label: "Vulnerability Count" },
        { key: "maxSeverity", label: "Max Severity" },
        { key: "status", label: "Status" },
      ],
      rows: data.assets.items,
    });
  };

  return (
    <div>
      <PageHeader
        title="Asset Management"
        description={`${data.summary.totalAssets} monitored assets across ${data.regionOptions.length} regions`}
        actions={
          <Button onClick={handleExport} className="gradient-accent border-0 text-white">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 animate-stagger md:grid-cols-4">
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-[#0A1A2D] dark:text-[#38BDF8]"><Server className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.totalAssets}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">Total Assets</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0C5CAB]/10 text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]"><Monitor className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.atmCount}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">ATMs</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-[#1A0A2D] dark:text-[#C084FC]"><Shield className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.gabCount}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">GABs</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-[#3B0F0F] dark:text-[#F87171]"><Globe className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-red-600 dark:text-[#F87171]">{data.summary.internetFacing}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">Internet-Facing</p>
          </div>
        </Card>
      </div>

      <Card className="mb-4 border border-[#E9ECEF] bg-white p-4 dark:border-[#27272a] dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search assets, IDs, branches..."
            value={filters.search}
            onChange={(value) => updateFilters({ search: value, page: 1 })}
            className="w-full sm:w-64"
          />
          <Select
            value={filters.type}
            onValueChange={(value) => updateFilters({ type: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Asset Type" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Types</SelectItem>
              <SelectItem value="atm" className="cursor-pointer">ATM</SelectItem>
              <SelectItem value="gab" className="cursor-pointer">GAB</SelectItem>
              <SelectItem value="server" className="cursor-pointer">Server</SelectItem>
              <SelectItem value="network_device" className="cursor-pointer">Network Device</SelectItem>
              <SelectItem value="kiosk" className="cursor-pointer">Kiosk</SelectItem>
              <SelectItem value="workstation" className="cursor-pointer">Workstation</SelectItem>
              <SelectItem value="other" className="cursor-pointer">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.regionId}
            onValueChange={(value) => updateFilters({ regionId: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[200px]"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Regions</SelectItem>
              {data.regionOptions.map((region) => (
                <SelectItem key={region.id} value={region.id} className="cursor-pointer">{region.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.criticality}
            onValueChange={(value) => updateFilters({ criticality: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Criticality" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Criticality</SelectItem>
              {["critical", "high", "medium", "low"].map((criticality) => (
                <SelectItem key={criticality} value={criticality} className="cursor-pointer">
                  {criticality.charAt(0).toUpperCase() + criticality.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilters({ status: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
              {["active", "maintenance", "inactive", "decommissioned"].map((status) => (
                <SelectItem key={status} value={status} className="cursor-pointer">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.exposureLevel}
            onValueChange={(value) => updateFilters({ exposureLevel: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[160px]"><SelectValue placeholder="Exposure" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Exposure</SelectItem>
              <SelectItem value="internet_facing" className="cursor-pointer">Internet-Facing</SelectItem>
              <SelectItem value="internal" className="cursor-pointer">Internal</SelectItem>
              <SelectItem value="isolated" className="cursor-pointer">Isolated</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
          >
            Clear
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280] dark:border-[#27272a] dark:text-[#94A3B8]">
          <span>{data.assets.total} assets match the current view</span>
          <span>{activeFilters > 0 ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} active` : "No active filters"}</span>
        </div>
      </Card>

      {data.assets.items.length === 0 ? (
        <Card className="border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <EmptyState
            icon={<Server className="h-7 w-7 text-[#0C5CAB] dark:text-[#60A5FA]" />}
            title="No assets match these filters"
            description="Try widening the filters or clear the current search to see the monitored asset inventory again."
            actionLabel="Clear filters"
            onAction={clearFilters}
            compact
          />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <div className="space-y-3 p-4 md:hidden">
            {data.assets.items.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-[#E9ECEF] p-4 dark:border-[#27272a]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-[#6B7280] dark:text-[#64748B]">{asset.id}</p>
                    <Link href={`/assets/${asset.id}`} className="mt-1 block text-sm font-semibold text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">
                      {asset.name}
                    </Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                  </div>
                  <Link href={`/assets/${asset.id}`}>
                    <Button variant="ghost" size="sm" aria-label={`Open asset ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Branch</p>
                    <p className="text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Exposure</p>
                    <p className="text-[#1A1A2E] dark:text-[#fafafa]">{asset.exposureLevel}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Severity</p>
                    <SeverityBadge severity={asset.maxSeverity} />
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Priority</p>
                    <PriorityBadge priority={asset.contextualPriority} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] pt-3 dark:border-[#27272a]">
                  <StatusBadge status={asset.status} />
                  <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount} vulnerabilities</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    {["Asset ID", "Name / Model", "Type", "Branch / Region", "Criticality", "Exposure", "Vulns", "Max Severity", "Priority", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.assets.items.map((asset) => (
                    <tr key={asset.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                      <td className="px-4 py-3 font-mono text-xs text-[#6B7280] dark:text-[#64748B]">{asset.id}</td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${asset.id}`} className="text-sm font-medium text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">{asset.name}</Link>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                      </td>
                      <td className="px-4 py-3"><span className="rounded border border-[#E9ECEF] bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8]">{asset.type}</span></td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.region}</p>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={asset.criticality.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} /></td>
                      <td className="px-4 py-3"><span className={`${asset.exposureLevel === "Internet-Facing" ? "text-red-600 dark:text-red-400" : asset.exposureLevel === "Internal" ? "text-blue-600 dark:text-blue-400" : "text-[#6B7280] dark:text-[#94A3B8]"} text-xs font-medium`}>{asset.exposureLevel}</span></td>
                      <td className="px-4 py-3 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={asset.maxSeverity} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={asset.contextualPriority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${asset.id}`} className="cursor-pointer">
                          <Button variant="ghost" size="sm" aria-label={`Open asset ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            currentPage={data.assets.page}
            totalPages={data.assets.totalPages}
            totalItems={data.assets.total}
            pageSize={data.assets.pageSize}
            itemLabel="assets"
            onPageChange={(page) => updateFilters({ page })}
          />
        </Card>
      )}
    </div>
  );
}
