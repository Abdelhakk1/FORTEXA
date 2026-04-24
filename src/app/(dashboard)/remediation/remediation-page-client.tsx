"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge, PriorityBadge, StatusBadge, SlaBadge } from "@/components/shared/badges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { updateRemediationTaskAction } from "@/actions/remediation";
import { downloadCsv } from "@/lib/download";
import type { listRemediationTasks } from "@/lib/services/remediation";
import { Wrench, CheckCircle2, AlertTriangle, Clock, LayoutGrid, List, Download } from "lucide-react";

type RemediationPageData = Awaited<ReturnType<typeof listRemediationTasks>>;

interface RemediationPageClientProps {
  data: RemediationPageData;
  viewerProfileId: string | null;
  canWrite: boolean;
  canUpdateStatus: boolean;
}

function toTaskFormState(task: RemediationPageData["tasks"][number]) {
  return {
    assignedTo: task.assignedToId ?? "",
    dueDate: task.dueDateIso ? task.dueDateIso.slice(0, 10) : "",
    status: task.statusDb,
    priority: task.priorityDb,
    progress: task.progress,
    notes: task.notes,
    changeRequest: task.changeRequest ?? "",
  };
}

export function RemediationPageClient({
  data,
  viewerProfileId,
  canWrite,
  canUpdateStatus,
}: RemediationPageClientProps) {
  const fieldClassName =
    "h-11 w-full rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-3.5 text-sm text-[#1A1A2E] transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]";
  const textAreaClassName =
    "w-full rounded-2xl border border-[#E9ECEF] bg-[#F9FAFB] px-3.5 py-3 text-sm text-[#1A1A2E] transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]";
  const sectionLabelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#94A3B8]";
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [formState, setFormState] = useState({
    assignedTo: "",
    dueDate: "",
    status: "open",
    priority: "medium",
    progress: 0,
    notes: "",
    changeRequest: "",
  });

  const selectedTask = useMemo(
    () => data.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [data.tasks, selectedTaskId]
  );
  const canEditSelected =
    Boolean(selectedTask) &&
    (canWrite || canUpdateStatus || selectedTask?.assignedToId === viewerProfileId);
  const selectedAssigneeName =
    data.assignableProfiles.find((profile) => profile.id === formState.assignedTo)
      ?.fullName ??
    selectedTask?.assignedOwner ??
    "Unassigned";
  const isSuccessMessage = message === "Remediation task updated.";

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

  const openTask = (task: RemediationPageData["tasks"][number]) => {
    setSelectedTaskId(task.id);
    setFormState(toTaskFormState(task));
    setMessage(null);
  };

  const saveTask = () => {
    if (!selectedTask) {
      return;
    }

    startSaving(async () => {
      setMessage(null);
      const result = await updateRemediationTaskAction({
        id: selectedTask.id,
        assignedTo: canWrite ? formState.assignedTo || null : undefined,
        dueDate: canWrite ? (formState.dueDate ? new Date(formState.dueDate) : null) : undefined,
        status: formState.status as "open" | "assigned" | "in_progress" | "mitigated" | "closed" | "overdue",
        priority: canWrite ? (formState.priority as "critical" | "high" | "medium" | "low" | "info") : undefined,
        businessPriority: canWrite ? selectedTask.businessPriorityDb : undefined,
        progress: formState.progress,
        notes: formState.notes,
        changeRequest: formState.changeRequest,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage("Remediation task updated.");
      router.refresh();
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
                    <Card key={task.id} onClick={() => openTask(task)} className="cursor-pointer border border-[#E9ECEF] bg-white p-4 transition-all hover:border-[#D1D5DB] dark:border-[#27272a] dark:bg-[#141419] dark:hover:border-[#3a3a42]">
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
                  <tr key={task.id} onClick={() => openTask(task)} className="dark-table-row cursor-pointer border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
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

      <Sheet
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
            setMessage(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-[35rem] border-l border-[#E9ECEF] bg-white p-0 dark:border-[#27272a] dark:bg-[#141419]">
          <div className="flex h-full flex-col">
            <SheetHeader className="gap-3 border-b border-[#E9ECEF] bg-white/95 px-6 py-5 dark:border-[#27272a] dark:bg-[#141419]/95">
              <div className="space-y-3 pr-10">
                {selectedTask && (
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={selectedTask.priority} />
                    <PriorityBadge priority={selectedTask.businessPriority} />
                    <StatusBadge status={selectedTask.status} />
                    <SlaBadge status={selectedTask.slaStatus} />
                  </div>
                )}
                <div className="space-y-1">
                  <SheetTitle className="text-[1.75rem] font-semibold tracking-tight text-[#1A1A2E] dark:text-[#fafafa]">
                    {selectedTask?.title ?? "Task details"}
                  </SheetTitle>
                  <SheetDescription className="max-w-[42ch] text-[15px] leading-7 text-[#6B7280] dark:text-[#94A3B8]">
                    Update assignment, due date, progress, and remediation notes without leaving the queue.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {selectedTask && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-5">
                    {message && (
                      <div
                        className={`rounded-2xl border px-4 py-3 text-sm ${
                          isSuccessMessage
                            ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#047857] dark:border-[#134E4A] dark:bg-[#06231E] dark:text-[#6EE7B7]"
                            : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] dark:border-[#713F12] dark:bg-[#251706] dark:text-[#FCD34D]"
                        }`}
                      >
                        {message}
                      </div>
                    )}

                    <div className="rounded-[1.5rem] border border-[#E9ECEF] bg-[radial-gradient(circle_at_top_left,rgba(12,92,171,0.12),transparent_42%),linear-gradient(180deg,#FFFFFF_0%,#F9FAFB_100%)] p-5 dark:border-[#27272a] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_36%),linear-gradient(180deg,#141419_0%,#101117_100%)]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 dark:border-white/5 dark:bg-[#171821]">
                          <p className={sectionLabelClassName}>Target Asset</p>
                          <p className="mt-2 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            {selectedTask.relatedAsset}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 dark:border-white/5 dark:bg-[#171821]">
                          <p className={sectionLabelClassName}>CVE</p>
                          <p className="mt-2 text-sm font-semibold text-[#0C5CAB] dark:text-[#60A5FA]">
                            {selectedTask.relatedCve}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 dark:border-white/5 dark:bg-[#171821]">
                          <p className={sectionLabelClassName}>Assignee</p>
                          <p className="mt-2 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            {selectedAssigneeName}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 dark:border-white/5 dark:bg-[#171821]">
                          <p className={sectionLabelClassName}>Created By</p>
                          <p className="mt-2 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            {selectedTask.createdByName}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/70 bg-white/85 p-4 dark:border-white/5 dark:bg-[#171821]">
                        <div className="mb-2 flex items-center justify-between">
                          <p className={sectionLabelClassName}>Execution Progress</p>
                          <span className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            {formState.progress}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#22232c]">
                          <div
                            className="h-full rounded-full gradient-accent transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(formState.progress, 100))}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-[#6B7280] dark:text-[#94A3B8]">
                          <span>{formState.dueDate || "No due date set"}</span>
                          <span>{selectedTask.slaStatus}</span>
                        </div>
                      </div>
                    </div>

                    <Card className="border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#0f0f13]">
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <p className={sectionLabelClassName}>Assignment</p>
                          <h3 className="mt-1 text-base font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            Ownership & Schedule
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                          Keep the queue aligned with SLA expectations.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className={sectionLabelClassName}>Assignee</label>
                          <select
                            value={formState.assignedTo}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                assignedTo: event.target.value,
                              }))
                            }
                            disabled={!canWrite}
                            className={fieldClassName}
                          >
                            <option value="">Unassigned</option>
                            {data.assignableProfiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.fullName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className={sectionLabelClassName}>Due Date</label>
                            <input
                              type="date"
                              value={formState.dueDate}
                              onChange={(event) =>
                                setFormState((current) => ({
                                  ...current,
                                  dueDate: event.target.value,
                                }))
                              }
                              disabled={!canWrite}
                              className={fieldClassName}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={sectionLabelClassName}>Priority</label>
                            <select
                              value={formState.priority}
                              onChange={(event) =>
                                setFormState((current) => ({
                                  ...current,
                                  priority: event.target.value,
                                }))
                              }
                              disabled={!canWrite}
                              className={fieldClassName}
                            >
                              {["critical", "high", "medium", "low", "info"].map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#0f0f13]">
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <p className={sectionLabelClassName}>Execution</p>
                          <h3 className="mt-1 text-base font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            Status & Progress
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                          Keep task state truthful while work is in flight.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className={sectionLabelClassName}>Status</label>
                            <select
                              value={formState.status}
                              onChange={(event) =>
                                setFormState((current) => ({
                                  ...current,
                                  status: event.target.value,
                                }))
                              }
                              disabled={!canEditSelected}
                              className={fieldClassName}
                            >
                              {["open", "assigned", "in_progress", "mitigated", "closed", "overdue"].map((status) => (
                                <option key={status} value={status}>
                                  {status.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className={sectionLabelClassName}>Progress</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formState.progress}
                              onChange={(event) =>
                                setFormState((current) => ({
                                  ...current,
                                  progress: Number(event.target.value),
                                }))
                              }
                              disabled={!canEditSelected}
                              className={fieldClassName}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {[0, 25, 50, 75, 100].map((value) => (
                              <button
                                key={value}
                                type="button"
                                disabled={!canEditSelected}
                                onClick={() =>
                                  setFormState((current) => ({
                                    ...current,
                                    progress: value,
                                  }))
                                }
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  formState.progress === value
                                    ? "border-[#0C5CAB] bg-[#EFF6FF] text-[#0C5CAB] dark:border-[#60A5FA] dark:bg-[#0A1A2D] dark:text-[#60A5FA]"
                                    : "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:border-[#CBD5E1] hover:text-[#1A1A2E] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:border-[#3a3a42] dark:hover:text-[#fafafa]"
                                }`}
                              >
                                {value}%
                              </button>
                            ))}
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#22232c]">
                            <div
                              className="h-full rounded-full gradient-accent transition-all duration-300"
                              style={{ width: `${Math.max(0, Math.min(formState.progress, 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#0f0f13]">
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <p className={sectionLabelClassName}>Documentation</p>
                          <h3 className="mt-1 text-base font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                            Change Record & Notes
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                          Capture evidence that the next analyst can trust.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className={sectionLabelClassName}>Change Request</label>
                          <input
                            value={formState.changeRequest}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                changeRequest: event.target.value,
                              }))
                            }
                            disabled={!canEditSelected}
                            placeholder="CAB ticket, vendor case, or emergency change reference"
                            className={fieldClassName}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={sectionLabelClassName}>Notes / Evidence</label>
                          <textarea
                            rows={7}
                            value={formState.notes}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            disabled={!canEditSelected}
                            placeholder="What changed, what was validated, and what evidence supports the current state?"
                            className={textAreaClassName}
                          />
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="border-t border-[#E9ECEF] bg-white/95 px-6 py-4 dark:border-[#27272a] dark:bg-[#141419]/95">
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                      {canEditSelected
                        ? "Changes save directly to the live remediation queue."
                        : "You can review this task here, but only authorized users can update it."}
                    </p>
                    <Button
                      onClick={saveTask}
                      disabled={!canEditSelected || isSaving}
                      className="h-12 w-full gradient-accent border-0 text-base font-semibold text-white"
                    >
                      {isSaving ? "Saving..." : "Save Task Update"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
