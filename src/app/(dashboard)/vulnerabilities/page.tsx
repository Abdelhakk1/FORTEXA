"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Download, Eye, Columns } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { SeverityBadge, PriorityBadge, SlaBadge, KevBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import { useTheme } from "@/components/theme-provider";
import { vulnerabilities, severityDistribution, topVulnerableModels } from "@/lib/mock-data";

export default function VulnerabilitiesPage() {
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");
  const [kevFilter, setKevFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cve" | "asset">("cve");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";

  const filtered = useMemo(() => {
    return vulnerabilities.filter(v => {
      if (search && !v.cveId.toLowerCase().includes(search.toLowerCase()) && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (sevFilter !== "all" && v.severity !== sevFilter) return false;
      if (prioFilter !== "all" && v.businessPriority !== prioFilter) return false;
      if (kevFilter !== "all") {
        if (kevFilter === "yes" && v.exploitMaturity !== "Active in Wild (KEV)") return false;
        if (kevFilter === "no" && v.exploitMaturity === "Active in Wild (KEV)") return false;
      }
      if (slaFilter !== "all" && v.slaStatus !== slaFilter) return false;
      return true;
    });
  }, [search, sevFilter, prioFilter, kevFilter, slaFilter]);

  const clearFilters = () => { setSearch(""); setSevFilter("all"); setPrioFilter("all"); setKevFilter("all"); setSlaFilter("all"); };

  const donutOption = {
    tooltip: { trigger: "item" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark } },
    legend: { bottom: 0, left: "center", textStyle: { color: textLight, fontSize: 11 }, itemWidth: 8, itemHeight: 8, itemGap: 12 },
    series: [{
      type: "pie" as const, radius: ["50%", "78%"], center: ["50%", "42%"],
      itemStyle: { borderRadius: 5, borderColor: bgCard, borderWidth: 3 },
      label: {
        show: true, position: "center" as const, formatter: `{a|${vulnerabilities.length}}\n{b|CVEs}`,
        rich: { a: { fontSize: 24, fontWeight: "bold" as const, color: textDark, lineHeight: 32 }, b: { fontSize: 12, color: textLight, lineHeight: 18 } }
      },
      data: severityDistribution.map(s => ({ value: s.value, name: s.name, itemStyle: { color: s.color } })),
    }],
  };

  const barOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    grid: { top: 10, right: 20, bottom: 10, left: 130, containLabel: false },
    xAxis: { type: "value" as const, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 11 } },
    yAxis: { type: "category" as const, data: topVulnerableModels.map(m => m.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: textLight, fontSize: 12 } },
    series: [{
      type: "bar" as const, data: topVulnerableModels.map(m => m.value).reverse(),
      itemStyle: { color: (params: { dataIndex: number }) => ["#10B981", "#3B82F6", "#F59E0B", "#E8533F", "#EF4444"][params.dataIndex] || "#E8533F", borderRadius: [0, 4, 4, 0] },
      barWidth: 20,
    }],
  };

  return (
    <div>
      <PageHeader
        title="Vulnerability Management"
        description={`${vulnerabilities.length} CVEs identified across your ATM/GAB fleet`}
        actions={
          <div className="flex gap-2">
            {/* Segmented Control */}
            <div className="flex items-center border border-[#E9ECEF] dark:border-[#27272a] rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("cve")} className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${viewMode === "cve" ? "bg-[#0C5CAB] dark:bg-[#3B82F6] text-white dark:text-white" : "bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]"}`}>
                By CVE
              </button>
              <button onClick={() => setViewMode("asset")} className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${viewMode === "asset" ? "bg-[#0C5CAB] dark:bg-[#3B82F6] text-white dark:text-white" : "bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]"}`}>
                By Asset
              </button>
            </div>
            <Button className="gradient-accent text-white cursor-pointer border-0"><Download className="h-4 w-4 mr-2" /> Export Report</Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-5 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Search CVE, title..." value={search} onChange={setSearch} className="w-64" />
          <Select value={sevFilter} onValueChange={(v) => setSevFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Severity: All</SelectItem>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <SelectItem key={s} value={s} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={(v) => setPrioFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Biz Priority" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Biz Priority: All</SelectItem>
              {["P1", "P2", "P3", "P4", "P5"].map(p => <SelectItem key={p} value={p} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kevFilter} onValueChange={(v) => setKevFilter(v ?? "all")}>
            <SelectTrigger className="w-[180px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Exploitable (KEV)" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Exploitable (KEV): All</SelectItem>
              <SelectItem value="yes" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">Yes (KEV)</SelectItem>
              <SelectItem value="no" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">No</SelectItem>
            </SelectContent>
          </Select>
          <Select value={slaFilter} onValueChange={(v) => setSlaFilter(v ?? "all")}>
            <SelectTrigger className="w-[150px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="SLA Status" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">SLA Status: All</SelectItem>
              {["On Track", "At Risk", "Overdue"].map(s => <SelectItem key={s} value={s} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={clearFilters} className="text-sm text-[#0C5CAB] dark:text-[#60A5FA] hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] font-medium cursor-pointer">Clear</button>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-0.5">Severity Distribution</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">Breakdown of active vulnerabilities</p>
          <EChart option={donutOption} height="240px" />
        </Card>
        <Card className="p-5 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-0.5">Top Vulnerable Models</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">Findings by ATM model</p>
          <EChart option={barOption} height="240px" />
        </Card>
      </div>

      {/* Table */}
      <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Active Vulnerabilities</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DBEAFE] dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] text-[10px] font-bold px-1.5">
              {filtered.length}
            </span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]"><Columns className="h-4 w-4 mr-1" /> Columns</Button>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="dark-table-head">
                {["CVE", "Severity ↕", "Biz Priority ↕", "Affected ATMs ↕", "KEV ↕", "First Seen ↕", "SLA Due ↕", "Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(vuln => (
                <tr key={vuln.id} className="dark-table-row">
                  <td className="py-3 px-4">
                    <Link href={`/vulnerabilities/${vuln.id}`} className="text-[#0C5CAB] dark:text-[#60A5FA] font-semibold hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] cursor-pointer">{vuln.cveId}</Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#64748B] truncate max-w-[220px]">{vuln.title}</p>
                  </td>
                  <td className="py-3 px-4"><SeverityBadge severity={vuln.severity} score={vuln.cvssScore} /></td>
                  <td className="py-3 px-4"><PriorityBadge priority={vuln.businessPriority} /></td>
                  <td className="py-3 px-4 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{vuln.affectedAssetsCount}</td>
                  <td className="py-3 px-4"><KevBadge maturity={vuln.exploitMaturity} /></td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8] whitespace-nowrap">{vuln.firstSeen}</td>
                  <td className="py-3 px-4"><SlaBadge status={vuln.slaStatus} /></td>
                  <td className="py-3 px-4">
                    <Link href={`/vulnerabilities/${vuln.id}`}><Button variant="ghost" size="sm" className="h-9 w-9 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E9ECEF] dark:border-[#27272a] bg-[#FAFBFC] dark:bg-[#0f0f13]">
          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Showing 1-{filtered.length} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#64748B]" disabled>Prev</Button>
            <Button size="sm" className="h-7 w-7 p-0 bg-[#0C5CAB] dark:bg-[#3B82F6] text-white hover:bg-[#0a4a8a] dark:hover:bg-[#2563EB] cursor-pointer text-xs">1</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#FFFFFF] dark:bg-[#141419] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
