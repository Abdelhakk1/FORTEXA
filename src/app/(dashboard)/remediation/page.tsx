"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SeverityBadge, PriorityBadge, StatusBadge, SlaBadge } from "@/components/shared/badges";
import { remediationTasks } from "@/lib/mock-data";
import { Wrench, CheckCircle2, AlertTriangle, Clock, LayoutGrid, List, Eye, Plus } from "lucide-react";

export default function RemediationPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  
  const openCount = remediationTasks.filter(t => t.status === "Open").length;
  const inProgressCount = remediationTasks.filter(t => t.status === "In Progress").length;
  const closedCount = remediationTasks.filter(t => t.status === "Closed").length;
  const overdueCount = remediationTasks.filter(t => t.slaStatus === "Overdue").length;

  const columns = [
    { title: "Open", status: ["Open", "Assigned"], borderColor: "bg-blue-500 dark:bg-blue-400", count: remediationTasks.filter(t => t.status === "Open" || t.status === "Assigned").length },
    { title: "In Progress", status: ["In Progress"], borderColor: "bg-amber-500 dark:bg-amber-400", count: remediationTasks.filter(t => t.status === "In Progress").length },
    { title: "Mitigated", status: ["Mitigated"], borderColor: "bg-emerald-500 dark:bg-emerald-400", count: remediationTasks.filter(t => t.status === "Mitigated").length },
    { title: "Closed", status: ["Closed"], borderColor: "bg-[#52525B] dark:bg-[#A1A1AA]", count: remediationTasks.filter(t => t.status === "Closed").length },
  ];

  return (
    <div>
      <PageHeader
        title="Remediation"
        description="Track and manage vulnerability remediation tasks"
        actions={
          <div className="flex gap-2">
            <div className="flex items-center border border-[#E9ECEF] dark:border-[#27272a] rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-[#0C5CAB] dark:bg-[#3B82F6] text-white" : "bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]"}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${viewMode === "table" ? "bg-[#0C5CAB] dark:bg-[#3B82F6] text-white" : "bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]"}`}>
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <Button className="gradient-accent text-white cursor-pointer border-0"><Plus className="h-4 w-4 mr-2" /> New Task</Button>
          </div>
        }
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
        <KpiCard label="Open Tasks" value={openCount + remediationTasks.filter(t => t.status === "Assigned").length} icon={<Wrench className="h-5 w-5" />} />
        <KpiCard label="In Progress" value={inProgressCount} change={`${remediationTasks.filter(t => t.status === "In Progress").reduce((s, t) => s + t.progress, 0) / Math.max(inProgressCount, 1) | 0}% avg progress`} changeType="neutral" icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="Completed" value={closedCount} change="+6 last 30 days" changeType="positive" icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard label="Overdue" value={overdueCount} change="SLA breach" changeType="negative" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(col => (
            <div key={col.title} className="space-y-3">
              <Card className="p-3 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] relative overflow-hidden">
                {/* Colored top line */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${col.borderColor}`} />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{col.title}</h3>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] text-[10px] font-bold px-1.5">{col.count}</span>
                </div>
              </Card>
              {remediationTasks.filter(t => col.status.includes(t.status)).map(task => (
                <Card key={task.id} className="p-4 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] hover:border-[#D1D5DB] dark:hover:border-[#3a3a42] transition-all cursor-pointer group">
                  <div className="flex items-start gap-2 mb-2">
                    <SeverityBadge severity={task.priority} />
                    {task.slaStatus === "Overdue" && <SlaBadge status="Overdue" />}
                  </div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] mb-1 leading-snug group-hover:text-[#0C5CAB] dark:group-hover:text-[#60A5FA] transition-colors">{task.title}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#64748B] mb-3">{task.relatedCve} · {task.relatedAsset}</p>
                  {task.progress > 0 && task.progress < 100 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#6B7280] dark:text-[#64748B]">Progress</span>
                        <span className="text-[10px] font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{task.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[#F3F4F6] dark:bg-[#1a1a22] rounded-full overflow-hidden">
                        <div className="h-full gradient-accent rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6] dark:border-[#27272a]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DBEAFE] dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] text-[10px] font-bold">{task.assignedAvatar}</div>
                      <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{task.assignedOwner.split(" ")[0]}</span>
                    </div>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#64748B]">Due: {task.dueDate}</span>
                  </div>
                </Card>
              ))}
              {remediationTasks.filter(t => col.status.includes(t.status)).length === 0 && (
                <Card className="p-6 border border-dashed border-[#D1D5DB] dark:border-[#3a3a42] bg-transparent text-center">
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">No tasks in this column</p>
                </Card>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="dark-table-head">
                  {["Task", "CVE", "Priority", "Status", "Owner", "Progress", "SLA", "Due Date"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remediationTasks.map(task => (
                  <tr key={task.id} className="dark-table-row">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{task.title}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{task.relatedAsset}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#0C5CAB] dark:text-[#60A5FA] font-semibold">{task.relatedCve}</td>
                    <td className="py-3 px-4"><PriorityBadge priority={task.businessPriority} /></td>
                    <td className="py-3 px-4"><StatusBadge status={task.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DBEAFE] dark:bg-[#0A1A2D] text-[#0C5CAB] dark:text-[#60A5FA] text-[10px] font-bold shrink-0">{task.assignedAvatar}</div>
                        <span className="text-sm text-[#6B7280] dark:text-[#94A3B8]">{task.assignedOwner}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 w-24">
                        <div className="flex-1 h-1.5 bg-[#F3F4F6] dark:bg-[#1a1a22] rounded-full"><div className="h-full gradient-accent rounded-full" style={{ width: `${task.progress}%` }} /></div>
                        <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#fafafa]">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><SlaBadge status={task.slaStatus} /></td>
                    <td className="py-3 px-4 text-sm text-[#6B7280] dark:text-[#94A3B8] whitespace-nowrap">{task.dueDate}</td>
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
