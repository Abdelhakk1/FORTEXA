"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { KpiCard } from "@/components/shared/kpi-card";
import { SeverityBadge, StatusBadge } from "@/components/shared/badges";
import { alerts } from "@/lib/mock-data";
import {
  Bell, AlertTriangle, Shield, Bug, ExternalLink, CheckCircle2, Clock,
  AlertCircle, ShieldAlert, Siren, FileWarning,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const typeIcons: Record<string, React.ReactNode> = {
  "Critical Risk": <ShieldAlert className="h-4 w-4" />,
  "Exposed ATM": <AlertCircle className="h-4 w-4" />,
  "Overdue Remediation": <Clock className="h-4 w-4" />,
  "New Critical CVE": <Bug className="h-4 w-4" />,
  "Policy Violation": <FileWarning className="h-4 w-4" />,
  "SLA Breach": <Siren className="h-4 w-4" />,
};

export default function AlertsPage() {
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (sevFilter !== "all" && a.severity !== sevFilter) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [search, sevFilter, typeFilter, statusFilter]);

  const clearFilters = () => { setSearch(""); setSevFilter("all"); setTypeFilter("all"); setStatusFilter("all"); };

  const newCount = alerts.filter(a => a.status === "New").length;
  const criticalCount = alerts.filter(a => a.severity === "CRITICAL").length;
  const ackCount = alerts.filter(a => a.status === "Acknowledged" || a.status === "In Progress").length;
  const resolvedCount = alerts.filter(a => a.status === "Resolved").length;

  const types = [...new Set(alerts.map(a => a.type))];

  return (
    <div>
      <PageHeader
        title="Alerts"
        description={`${alerts.length} security alerts requiring attention`}
        actions={
          <Button className="gradient-accent text-white cursor-pointer border-0">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Mark All Read
          </Button>
        }
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
        <KpiCard label="New Alerts" value={newCount} change="Requires attention" changeType="negative" icon={<Bell className="h-5 w-5" />} accentColor="border-l-red-500" />
        <KpiCard label="Critical" value={criticalCount} change="Highest priority" changeType="negative" icon={<AlertTriangle className="h-5 w-5" />} accentColor="border-l-red-500" />
        <KpiCard label="In Progress" value={ackCount} change="Being investigated" changeType="neutral" icon={<Shield className="h-5 w-5" />} accentColor="border-l-amber-500" />
        <KpiCard label="Resolved" value={resolvedCount} change="Last 30 days" changeType="positive" icon={<CheckCircle2 className="h-5 w-5" />} accentColor="border-l-emerald-500" />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Search alerts..." value={search} onChange={setSearch} className="w-64" />
          <Select value={sevFilter} onValueChange={(v) => setSevFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Severities</SelectItem>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <SelectItem key={s} value={s} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="w-[180px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Types</SelectItem>
              {types.map(t => <SelectItem key={t} value={t} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px] h-9 cursor-pointer bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
              <SelectItem value="all" className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">All Statuses</SelectItem>
              {["New", "Acknowledged", "In Progress", "Resolved", "Dismissed"].map(s => <SelectItem key={s} value={s} className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#F3F4F6] dark:focus:bg-[#1a1a22] focus:text-[#1A1A2E] dark:focus:text-[#fafafa]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={clearFilters} className="text-sm text-[#0C5CAB] dark:text-[#60A5FA] hover:text-[#0a4a8a] dark:hover:text-[#93C5FD] font-medium cursor-pointer">Clear</button>
        </div>
      </Card>

      {/* Alert List */}
      <div className="space-y-2">
        {filtered.map(alert => (
          <Card key={alert.id} className={`p-4 border transition-all hover:border-[#D1D5DB] dark:hover:border-[#3a3a42] cursor-pointer bg-white dark:bg-[#141419] relative overflow-hidden ${alert.status === "New" ? "border-[#E9ECEF] dark:border-[#27272a]" : "border-[#E9ECEF] dark:border-[#27272a]"}`}>
            {alert.status === "New" && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C5CAB] dark:bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]" />}
            <div className="flex items-start gap-4">
              {/* Type Icon */}
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                alert.severity === "CRITICAL" ? "bg-red-50 dark:bg-[#3B0F0F] text-red-600 dark:text-[#F87171]" :
                alert.severity === "HIGH" ? "bg-orange-50 dark:bg-[#2D1B0A] text-orange-600 dark:text-[#F8C171]" :
                "bg-amber-50 dark:bg-[#2D2A0A] text-amber-600 dark:text-[#FCD34D]"
              }`}>
                {typeIcons[alert.type] || <AlertTriangle className="h-4 w-4" />}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{alert.title}</p>
                  {alert.status === "New" && (
                    <span className="h-2 w-2 rounded-full bg-[#0C5CAB] dark:bg-[#3B82F6] shrink-0 animate-subtle-pulse shadow-[0_0_6px_#3B82F6]" />
                  )}
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">{alert.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] dark:text-[#64748B]">
                  <span>{alert.relatedAsset}</span>
                  <span>·</span>
                  <span>{alert.relatedCve}</span>
                  <span>·</span>
                  <span>{alert.createdAt}</span>
                  <span>·</span>
                  <span>{alert.owner}</span>
                </div>
              </div>
              {/* Right Side */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
