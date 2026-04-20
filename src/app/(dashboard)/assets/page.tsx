"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Eye, Download, Server, Monitor, Globe, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { SeverityBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { assets } from "@/lib/mock-data";

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [critFilter, setCritFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (regionFilter !== "all" && a.region !== regionFilter) return false;
      if (critFilter !== "all" && a.criticality !== critFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [search, typeFilter, regionFilter, critFilter, statusFilter]);

  const regions = [...new Set(assets.map(a => a.region))];
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setRegionFilter("all"); setCritFilter("all"); setStatusFilter("all"); };

  const totalAssets = assets.length;
  const atmCount = assets.filter(a => a.type === "ATM").length;
  const gabCount = assets.filter(a => a.type === "GAB").length;
  const internetFacing = assets.filter(a => a.exposureLevel === "Internet-Facing").length;

  return (
    <div>
      <PageHeader
        title="Asset Management"
        description={`${assets.length} monitored assets across ${regions.length} regions`}
        actions={
          <Button className="gradient-accent text-white cursor-pointer border-0">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        }
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 animate-stagger">
        <Card className="p-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] flex items-center justify-center flex-col text-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-[#0A1A2D] text-blue-600 dark:text-[#38BDF8] shrink-0 mb-1"><Server className="h-4 w-4" /></div>
          <div>
            <p className="text-3xl font-extrabold text-[#1A1A2E] dark:text-[#fafafa] leading-none mb-1">{totalAssets}</p>
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide">Total Assets</p>
          </div>
        </Card>
        <Card className="p-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] flex items-center justify-center flex-col text-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0C5CAB]/10 dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] shrink-0 mb-1"><Monitor className="h-4 w-4" /></div>
          <div>
            <p className="text-3xl font-extrabold text-[#1A1A2E] dark:text-[#fafafa] leading-none mb-1">{atmCount}</p>
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide">ATMs</p>
          </div>
        </Card>
        <Card className="p-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] flex items-center justify-center flex-col text-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 dark:bg-[#1A0A2D] text-purple-600 dark:text-[#C084FC] shrink-0 mb-1"><Shield className="h-4 w-4" /></div>
          <div>
            <p className="text-3xl font-extrabold text-[#1A1A2E] dark:text-[#fafafa] leading-none mb-1">{gabCount}</p>
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide">GABs</p>
          </div>
        </Card>
        <Card className="p-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] flex items-center justify-center flex-col text-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 dark:bg-[#3B0F0F] text-red-600 dark:text-[#F87171] shrink-0 mb-1"><Globe className="h-4 w-4" /></div>
          <div>
            <p className="text-3xl font-extrabold text-red-600 dark:text-[#F87171] leading-none mb-1">{internetFacing}</p>
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide">Internet-Facing</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Search assets, IDs..." value={search} onChange={setSearch} className="w-64" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Asset Type" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Types</SelectItem>
              <SelectItem value="ATM" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">ATM</SelectItem>
              <SelectItem value="GAB" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">GAB</SelectItem>
              <SelectItem value="Server" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Server</SelectItem>
              <SelectItem value="Network Device" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Network Device</SelectItem>
              <SelectItem value="Kiosk" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Kiosk</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v ?? "all")}>
            <SelectTrigger className="w-[200px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={critFilter} onValueChange={(v) => setCritFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Criticality" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Criticality</SelectItem>
              {["Critical", "High", "Medium", "Low"].map(c => <SelectItem key={c} value={c} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Statuses</SelectItem>
              {["Active", "Maintenance", "Inactive"].map(s => <SelectItem key={s} value={s} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={clearFilters} className="text-sm text-[#0C5CAB] dark:text-[#60A5FA] hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] font-medium cursor-pointer">Clear</button>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="dark-table-head">
                {["Asset ID", "Name / Model", "Type", "Branch / Region", "Criticality", "Exposure", "Vulns", "Max Severity", "Priority", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => (
                <tr key={asset.id} className="dark-table-row">
                  <td className="py-3 px-4 font-mono text-xs text-[#6B7280] dark:text-[#64748B]">{asset.id}</td>
                  <td className="py-3 px-4">
                    <Link href={`/assets/${asset.id}`} className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] cursor-pointer">{asset.name}</Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                  </td>
                  <td className="py-3 px-4"><span className="text-xs font-medium bg-[#F3F4F6] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] px-2 py-0.5 rounded border border-[#E9ECEF] dark:border-[#27272a]">{asset.type}</span></td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.region}</p>
                  </td>
                  <td className="py-3 px-4"><SeverityBadge severity={asset.criticality.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} /></td>
                  <td className="py-3 px-4"><span className={`text-xs font-medium ${asset.exposureLevel === "Internet-Facing" ? "text-red-600 dark:text-red-400" : asset.exposureLevel === "Internal" ? "text-blue-600 dark:text-blue-400" : "text-[#6B7280] dark:text-[#94A3B8]"}`}>{asset.exposureLevel}</span></td>
                  <td className="py-3 px-4 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount}</td>
                  <td className="py-3 px-4"><SeverityBadge severity={asset.maxSeverity} /></td>
                  <td className="py-3 px-4"><PriorityBadge priority={asset.contextualPriority} /></td>
                  <td className="py-3 px-4"><StatusBadge status={asset.status} /></td>
                  <td className="py-3 px-4">
                    <Link href={`/assets/${asset.id}`} className="cursor-pointer">
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E9ECEF] dark:border-[#27272a] bg-[#FAFBFC] dark:bg-[#0f0f13]">
          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Showing {filtered.length} of {assets.length} assets</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#64748B]" disabled>Prev</Button>
            <Button size="sm" className="h-7 w-7 p-0 bg-[#0C5CAB] dark:bg-[#3B82F6] text-white hover:bg-[#0a4a8a] dark:hover:bg-[#2563EB] cursor-pointer text-xs">1</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#FFFFFF] dark:bg-[#141419] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]">2</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#FFFFFF] dark:bg-[#141419] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
