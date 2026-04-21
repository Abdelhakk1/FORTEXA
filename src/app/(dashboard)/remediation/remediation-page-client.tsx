"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge, PriorityBadge, StatusBadge, SlaBadge } from "@/components/shared/badges";
import { downloadCsv } from "@/lib/download";
import type { listRemediationTasks } from "@/lib/services/remediation";
import { Wrench, CheckCircle2, AlertTriangle, Clock, LayoutGrid, List, Download } from "lucide-react";

type RemediationPageData = Awaited<ReturnType<typeof listRemediationTasks>>;

interface RemediationPageClientProps {
  data: RemediationPageData;
}

export function RemediationPageClient({ data }: RemediationPageClientProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const columns = [
    { title: "Open", status: ["Open", "Assigned"], borderColor: "bg-blue-500 dark:bg-blue-400" },
    { title: "In Progress", status: ["In Progress"], borderColor: "bg-amber-500 dark:bg-amber-400" },
    { title: "Mitigated", status: ["Mitigated"], borderColor: "bg-emerald-500 dark:bg-emerald-400" },
    { title: "Closed", status: ["Closed"], borderColor: "bg-[#52525B] dark:bg-[#A1A1AA]" },
  ] as const;

  const exportQueue = () => {
    downloadCsv({
      filename: "fortexa-remediation-queue.csv",
      columns: [
        { key: "title", label: "Task" },
        { key: "relatedCve", label: "Related CVE" },
        { key: "relatedAsset", label: "Related Asset" },
        { key: "businessPriority", label: "Business Priority" },
        { key: "status", label: "Status" },
        { key: "slaStatus", label: "SLA Status" },
        { key: "assignedOwner", label: "Owner" },
        { key: "progress", label: "Progress" },
        { key: "dueDate", label: "Due Date" },
      ],
      rows: data.tasks,
    });
  };

  return (
    <div>
      <PageHeader
        title="Remediation"
        description="Track and manage vulnerability remediation tasks"
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-[#E9ECEF] dark:border-[#27272a]">
              <button
                type="button"
                aria-pressed={viewMode === "kanban"}
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-[#0C5CAB] text-white dark:bg-[#3B82F6]" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a]"}`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <Button onClick={exportQueue} className="gradient-accent border-0 text-white">
              <Download className="mr-2 h-4 w-4" /> Export Queue
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 animate-stagger md:grid-cols-4">
        <KpiCard label="Open Tasks" value={data.summary.openCount} icon={<Wrench className="h-5 w-5" />} />
        <KpiCard label="In Progress" value={data.summary.inProgressCount} change={`${data.tasks.filter((task) => task.status === "In Progress").reduce((sum, task) => sum + task.progress, 0) / Math.max(data.summary.inProgressCount, 1) | 0}% avg progress`} changeType="neutral" icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="Completed" value={data.summary.closedCount} change="Live backend queue" changeType="positive" icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard label="Overdue" value={data.summary.overdueCount} change="SLA breach risk" changeType={data.summary.overdueCount > 0 ? "negative" : "positive"} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Card className="mb-4 border border-[#E9ECEF] bg-white px-4 py-3 text-xs text-[#6B7280] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#94A3B8]">
        Tasks are sorted by SLA urgency first, then by due date, so the most time-sensitive remediation work stays at the top of both views.
      </Card>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = data.tasks.filter((task) => column.status.some((status) => status === task.status));

            return (
              <div key={column.title} className="space-y-3">
                <Card className="relative overflow-hidden border border-[#E9ECEF] bg-white p-3 dark:border-[#27272a] dark:bg-[#141419]">
                  <div className={`absolute left-0 right-0 top-0 h-[2px] ${column.borderColor}`} />
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{column.title}</h3>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[10px] font-bold text-[#6B7280] dark:bg-[#1a1a22] dark:text-[#94A3B8]">
                      {columnTasks.length}
                    </span>
                  </div>
                </Card>

                {columnTasks.length === 0 ? (
                  <Card className="border border-dashed border-[#D1D5DB] bg-transparent p-6 text-center dark:border-[#3a3a42]">
                    <EmptyState
                      title="No tasks in this lane"
                      description="This status column is currently clear."
                      compact
                    />
                  </Card>
                ) : (
                  columnTasks.map((task) => (
                    <Card key={task.id} className="border border-[#E9ECEF] bg-white p-4 transition-all hover:border-[#D1D5DB] dark:border-[#27272a] dark:bg-[#141419] dark:hover:border-[#3a3a42]">
                      <div className="mb-2 flex items-start gap-2">
                        <SeverityBadge severity={task.priority} />
                        {task.slaStatus === "Overdue" && <SlaBadge status="Overdue" />}
                      </div>
                      <p className="mb-1 text-sm font-medium leading-snug text-[#1A1A2E] dark:text-[#fafafa]">{task.title}</p>
                      <p className="mb-3 text-xs text-[#6B7280] dark:text-[#64748B]">{task.relatedCve} · {task.relatedAsset}</p>

                      {task.progress > 0 && task.progress < 100 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10px] text-[#6B7280] dark:text-[#64748B]">Progress</span>
                            <span className="text-[10px] font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{task.progress}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-[#1a1a22]">
                            <div className="h-full rounded-full gradient-accent transition-all" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Owner</p>
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DBEAFE] text-[10px] font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">{task.assignedAvatar}</div>
                            <span className="text-[#1A1A2E] dark:text-[#fafafa]">{task.assignedOwner}</span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Due</p>
                          <p className="text-[#1A1A2E] dark:text-[#fafafa]">{task.dueDate}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                  {["Task", "CVE", "Priority", "Status", "Owner", "Progress", "SLA", "Due Date"].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{task.title}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{task.relatedAsset}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#0C5CAB] dark:text-[#60A5FA]">{task.relatedCve}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={task.businessPriority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[10px] font-bold text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">{task.assignedAvatar}</div>
                        <span className="text-sm text-[#6B7280] dark:text-[#94A3B8]">{task.assignedOwner}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex w-24 items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-[#F3F4F6] dark:bg-[#1a1a22]">
                          <div className="h-full rounded-full gradient-accent" style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#fafafa]">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><SlaBadge status={task.slaStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6B7280] dark:text-[#94A3B8]">{task.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
