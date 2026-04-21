"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge, StatusBadge } from "@/components/shared/badges";
import type { ActionResult } from "@/lib/errors";
import type { listAlerts } from "@/lib/services/alerts";
import {
  acknowledgeAlertAction,
  acknowledgeAllAlertsAction,
  dismissAlertAction,
  resolveAlertAction,
} from "@/actions/alerts";
import {
  Bell, AlertTriangle, Shield, Bug, CheckCircle2, Clock,
  AlertCircle, ShieldAlert, Siren, FileWarning,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  "Critical Risk": <ShieldAlert className="h-4 w-4" />,
  "Exposed ATM": <AlertCircle className="h-4 w-4" />,
  "Overdue Remediation": <Clock className="h-4 w-4" />,
  "New Critical CVE": <Bug className="h-4 w-4" />,
  "Policy Violation": <FileWarning className="h-4 w-4" />,
  "SLA Breach": <Siren className="h-4 w-4" />,
  "Import Error": <AlertTriangle className="h-4 w-4" />,
};

type AlertsPageData = Awaited<ReturnType<typeof listAlerts>>;

interface AlertsPageClientProps {
  data: AlertsPageData;
  filters: {
    search: string;
    severity: string;
    type: string;
    status: string;
    ownerId: string;
  };
}

const typeOptions = [
  { value: "critical_risk", label: "Critical Risk" },
  { value: "exposed_asset", label: "Exposed ATM" },
  { value: "overdue_remediation", label: "Overdue Remediation" },
  { value: "new_critical_cve", label: "New Critical CVE" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "import_error", label: "Import Error" },
];

export function AlertsPageClient({ data, filters }: AlertsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const updateFilters = (next: Partial<AlertsPageClientProps["filters"]>) => {
    const params = new URLSearchParams();
    const merged = {
      ...filters,
      ...next,
    };

    if (merged.search) params.set("search", merged.search);
    if (merged.severity !== "all") params.set("severity", merged.severity);
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.ownerId !== "all") params.set("ownerId", merged.ownerId);

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };

  const clearFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const runMutation = (
    action: () => Promise<ActionResult<unknown>>
  ) => {
    startTransition(async () => {
      setActionError(null);
      const result = await action();

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div>
      <PageHeader
        title="Alerts"
        description={`${data.summary.total} security alerts requiring attention`}
        actions={
          <Button
            onClick={() => runMutation(() => acknowledgeAllAlertsAction())}
            disabled={data.summary.newCount === 0 || isPending}
            className="gradient-accent border-0 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Acknowledge New
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 animate-stagger md:grid-cols-4">
        <KpiCard label="New Alerts" value={data.summary.newCount} change="Requires attention" changeType="negative" icon={<Bell className="h-5 w-5" />} accentColor="border-l-red-500" />
        <KpiCard label="Critical" value={data.summary.criticalCount} change="Highest priority" changeType="negative" icon={<AlertTriangle className="h-5 w-5" />} accentColor="border-l-red-500" />
        <KpiCard label="Triaged" value={data.summary.triagedCount} change="Being investigated" changeType="neutral" icon={<Shield className="h-5 w-5" />} accentColor="border-l-amber-500" />
        <KpiCard label="Resolved" value={data.summary.resolvedCount} change="Closed this cycle" changeType="positive" icon={<CheckCircle2 className="h-5 w-5" />} accentColor="border-l-emerald-500" />
      </div>

      <Card className="mb-4 border border-[#E9ECEF] bg-white p-4 dark:border-[#27272a] dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Search alerts or related assets..." value={filters.search} onChange={(value) => updateFilters({ search: value })} className="w-full sm:w-64" />
          <Select value={filters.severity} onValueChange={(value) => updateFilters({ severity: value ?? "all" })}>
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Severities</SelectItem>
              {["critical", "high", "medium", "low"].map((severity) => (
                <SelectItem key={severity} value={severity} className="cursor-pointer">
                  {severity.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={(value) => updateFilters({ type: value ?? "all" })}>
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Types</SelectItem>
              {typeOptions.map((type) => (
                <SelectItem key={type.value} value={type.value} className="cursor-pointer">{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value ?? "all" })}>
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
              {[
                { value: "new", label: "New" },
                { value: "acknowledged", label: "Acknowledged" },
                { value: "in_progress", label: "In Progress" },
                { value: "resolved", label: "Resolved" },
                { value: "dismissed", label: "Dismissed" },
              ].map((status) => (
                <SelectItem key={status.value} value={status.value} className="cursor-pointer">{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.ownerId} onValueChange={(value) => updateFilters({ ownerId: value ?? "all" })}>
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[200px]"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Owners</SelectItem>
              {data.owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id} className="cursor-pointer">{owner.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={clearFilters} className="text-sm font-medium text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]">
            Clear
          </button>
        </div>
      </Card>

      {actionError ? (
        <Card className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {actionError}
        </Card>
      ) : null}

      {data.alerts.items.length === 0 ? (
        <Card className="border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <EmptyState
            title="No alerts match these filters"
            description="Try broadening the filters or clear the current search to return to the active alert queue."
            actionLabel="Clear filters"
            onAction={clearFilters}
            compact
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.alerts.items.map((alert) => {
            const isOpen =
              alert.status === "New" ||
              alert.status === "Acknowledged" ||
              alert.status === "In Progress";

            return (
              <Card key={alert.id} className="relative overflow-hidden border border-[#E9ECEF] bg-white p-4 transition-all hover:border-[#D1D5DB] dark:border-[#27272a] dark:bg-[#141419] dark:hover:border-[#3a3a42]">
                {alert.status === "New" && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C5CAB] shadow-[0_0_8px_#3B82F6] dark:bg-[#3B82F6]" />}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        alert.severity === "CRITICAL"
                          ? "bg-red-50 text-red-600 dark:bg-[#3B0F0F] dark:text-[#F87171]"
                          : alert.severity === "HIGH"
                            ? "bg-orange-50 text-orange-600 dark:bg-[#2D1B0A] dark:text-[#F8C171]"
                            : "bg-amber-50 text-amber-600 dark:bg-[#2D2A0A] dark:text-[#FCD34D]"
                      }`}
                    >
                      {typeIcons[alert.type] || <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{alert.title}</p>
                        {alert.status === "New" && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#0C5CAB] shadow-[0_0_6px_#3B82F6] dark:bg-[#3B82F6]" />
                        )}
                      </div>
                      <p className="mb-2 text-xs text-[#6B7280] dark:text-[#94A3B8]">{alert.description}</p>
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
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3 dark:border-[#27272a]">
                  <div className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                    {isOpen ? "Open alert requiring action" : "Closed alert retained for audit history"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alert.status === "New" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runMutation(() => acknowledgeAlertAction(alert.id))}
                        disabled={isPending}
                        className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
                      >
                        Acknowledge
                      </Button>
                    )}
                    {isOpen && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runMutation(() => resolveAlertAction(alert.id))}
                        disabled={isPending}
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                      >
                        Resolve
                      </Button>
                    )}
                    {alert.status !== "Dismissed" && alert.status !== "Resolved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runMutation(() => dismissAlertAction(alert.id))}
                        disabled={isPending}
                        className="text-[#6B7280] hover:bg-[#F3F4F6] dark:bg-[#27272a] hover:text-[#1A1A2E] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#fafafa]"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
