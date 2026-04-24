"use client";

import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import type { Severity, BusinessPriority, RemediationStatus, AlertStatus, ExploitMaturity } from "@/lib/types";

/* ═══ Severity — Light + Dark pill badges ═══ */
const severityConfig: Record<Severity, { className: string; label: string }> = {
  CRITICAL: { className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50 dark:hover:bg-[#4B1515]", label: "CRITICAL" },
  HIGH: { className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-[#3B1F0A] dark:text-[#FB923C] dark:border-orange-900/50 dark:hover:bg-[#4B2510]", label: "HIGH" },
  MEDIUM: { className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50 dark:hover:bg-[#3D3510]", label: "MEDIUM" },
  LOW: { className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50 dark:hover:bg-[#103D20]", label: "LOW" },
  INFO: { className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-[#0A1A2D] dark:text-[#60A5FA] dark:border-blue-900/50 dark:hover:bg-[#10204D]", label: "INFO" },
};

export function SeverityBadge({ severity, score }: { severity: Severity; score?: number }) {
  const config = severityConfig[severity];
  return (
    <Badge variant="outline" className={`font-semibold text-xs rounded-full ${config.className}`}>
      {config.label}{score !== undefined ? ` (${score})` : ""}
    </Badge>
  );
}

/* ═══ Priority ═══ */
const priorityConfig: Record<BusinessPriority, { className: string; label: string }> = {
  P1: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50", label: "P1 — Critical" },
  P2: { className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-[#3B1F0A] dark:text-[#FB923C] dark:border-orange-900/50", label: "P2 — High" },
  P3: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50", label: "P3 — Medium" },
  P4: { className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0A1A2D] dark:text-[#60A5FA] dark:border-blue-900/50", label: "P4 — Low" },
  P5: { className: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:border-[#27272a]", label: "P5 — Minimal" },
};

export function PriorityBadge({ priority }: { priority: BusinessPriority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant="outline" className={`font-semibold text-xs rounded-full ${config.className}`}>
      {config.label}
    </Badge>
  );
}

/* ═══ Status ═══ */
const statusDotColors: Record<string, string> = {
  Open: "bg-gray-400",
  Assigned: "bg-blue-500",
  "In Progress": "bg-amber-500",
  Mitigated: "bg-emerald-500",
  Closed: "bg-gray-300 dark:bg-gray-600",
  Reopened: "bg-orange-500",
  "Accepted Risk": "bg-indigo-500",
  "False Positive": "bg-slate-500",
  "Compensating Control": "bg-teal-500",
  Overdue: "bg-red-500",
  New: "bg-blue-500 animate-subtle-pulse",
  Acknowledged: "bg-amber-500",
  Resolved: "bg-emerald-500",
  Dismissed: "bg-gray-300 dark:bg-gray-600",
  Completed: "bg-emerald-500",
  Pending: "bg-gray-400",
  Processing: "bg-blue-500 animate-subtle-pulse",
  Failed: "bg-red-500",
  Partial: "bg-amber-500",
  Active: "bg-emerald-500 animate-subtle-pulse",
  Inactive: "bg-gray-300 dark:bg-gray-600",
  Maintenance: "bg-amber-500",
  Decommissioned: "bg-gray-300 dark:bg-gray-600",
  Paused: "bg-gray-400",
};

const statusConfig: Record<string, { className: string }> = {
  Open: { className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:border-[#27272a]" },
  Assigned: { className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0A1A2D] dark:text-[#60A5FA] dark:border-blue-900/50" },
  "In Progress": { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50" },
  Mitigated: { className: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50" },
  Closed: { className: "bg-gray-50 text-gray-400 border-gray-200 dark:bg-[#1a1a22] dark:text-[#64748B] dark:border-[#27272a]" },
  Reopened: { className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-[#3B1F0A] dark:text-[#FB923C] dark:border-orange-900/50" },
  "Accepted Risk": { className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-[#0F172A] dark:text-[#A5B4FC] dark:border-indigo-900/50" },
  "False Positive": { className: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-[#111827] dark:text-[#CBD5E1] dark:border-slate-900/50" },
  "Compensating Control": { className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-[#042F2E] dark:text-[#5EEAD4] dark:border-teal-900/50" },
  Overdue: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50" },
  New: { className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0A1A2D] dark:text-[#60A5FA] dark:border-blue-900/50" },
  Acknowledged: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50" },
  Resolved: { className: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50" },
  Dismissed: { className: "bg-gray-50 text-gray-400 border-gray-200 dark:bg-[#1a1a22] dark:text-[#64748B] dark:border-[#27272a]" },
  Completed: { className: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50" },
  Pending: { className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:border-[#27272a]" },
  Processing: { className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0A1A2D] dark:text-[#60A5FA] dark:border-blue-900/50" },
  Failed: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50" },
  Partial: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50" },
  Active: { className: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50" },
  Inactive: { className: "bg-gray-50 text-gray-400 border-gray-200 dark:bg-[#1a1a22] dark:text-[#64748B] dark:border-[#27272a]" },
  Maintenance: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50" },
  Decommissioned: { className: "bg-gray-50 text-gray-300 border-gray-200 dark:bg-[#1a1a22] dark:text-[#475569] dark:border-[#27272a]" },
  Paused: { className: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:border-[#27272a]" },
};

export function StatusBadge({ status }: { status: RemediationStatus | AlertStatus | string }) {
  const config = statusConfig[status] || statusConfig.Open;
  const dotColor = statusDotColors[status] || "bg-gray-400";
  return (
    <Badge variant="outline" className={`font-medium text-xs gap-1.5 rounded-full ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      {status}
    </Badge>
  );
}

/* ═══ SLA ═══ */
const slaConfig: Record<string, { className: string; dotColor: string }> = {
  "On Track": { className: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50", dotColor: "bg-emerald-500" },
  "At Risk": { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#2D2A0A] dark:text-[#FCD34D] dark:border-amber-900/50", dotColor: "bg-amber-500" },
  Overdue: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50", dotColor: "bg-red-500" },
};

export function SlaBadge({ status, detail }: { status: string; detail?: string }) {
  const config = slaConfig[status] || slaConfig["On Track"];
  return (
    <Badge variant="outline" className={`font-semibold text-xs gap-1.5 rounded-full ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor}`} />
      {status}{detail ? ` (${detail})` : ""}
    </Badge>
  );
}

/* ═══ KEV ═══ */
export function KevBadge({ maturity }: { maturity: ExploitMaturity }) {
  if (maturity === "Active in Wild (KEV)") {
    return (
      <Badge className="bg-red-600 text-white border-red-600 hover:bg-red-700 text-xs font-semibold gap-1 rounded-full shadow-sm">
        <Flame className="h-3 w-3" />
        KEV
      </Badge>
    );
  }
  return <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">—</span>;
}

/* ═══ Scanner ═══ */
const scannerColors: Record<string, string> = {
  Nessus: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-[#0A1A2D] dark:text-[#38BDF8] dark:border-sky-900/50",
  OpenVAS: "bg-green-50 text-green-700 border-green-200 dark:bg-[#0A2D1A] dark:text-[#4ADE80] dark:border-green-900/50",
  Nmap: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-[#1A0A2D] dark:text-[#C084FC] dark:border-purple-900/50",
  Qualys: "bg-red-50 text-red-700 border-red-200 dark:bg-[#3B0F0F] dark:text-[#F87171] dark:border-red-900/50",
  Other: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:border-[#27272a]",
};

export function ScannerBadge({ source }: { source: string }) {
  const color = scannerColors[source] || scannerColors.Other;
  return (
    <Badge variant="outline" className={`font-semibold text-xs rounded-full ${color}`}>
      {source}
    </Badge>
  );
}
