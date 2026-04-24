import "server-only";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilityEvents,
  assetVulnerabilities,
  assets,
  cves,
  profiles,
  remediationTasks,
} from "@/db/schema";
import type { RemediationTask } from "@/lib/types";
import { AppError } from "@/lib/errors";
import {
  formatDate,
  getInitials,
  toUiBusinessPriority,
  toUiSeverity,
  toUiSlaStatus,
  toUiRemediationStatus,
} from "./serializers";
import { desc } from "./utils";

const slaRank = {
  overdue: 3,
  at_risk: 2,
  on_track: 1,
} as const;

export interface RemediationListItem extends RemediationTask {
  dbId: string;
  assignedToId: string | null;
  createdById: string;
  createdByName: string;
  assetVulnerabilityId: string | null;
  cveDbId: string | null;
  dueDateIso: string | null;
  priorityDb: typeof remediationTasks.$inferSelect.priority;
  businessPriorityDb: typeof remediationTasks.$inferSelect.businessPriority;
  statusDb: typeof remediationTasks.$inferSelect.status;
}

export interface AssignableProfileOption {
  id: string;
  fullName: string;
  email: string;
}

export const createRemediationTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    assetVulnerabilityId: z.string().uuid().nullable().optional(),
    cveId: z.string().uuid().nullable().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    slaStatus: z.enum(["on_track", "at_risk", "overdue"]).default("on_track"),
    status: z
      .enum(["open", "assigned", "in_progress", "mitigated", "closed", "overdue"])
      .default("open"),
    priority: z.enum(["critical", "high", "medium", "low", "info"]).default("medium"),
    businessPriority: z.enum(["p1", "p2", "p3", "p4", "p5"]).default("p3"),
    progress: z.number().int().min(0).max(100).default(0),
    notes: z.string().trim().max(4000).optional().or(z.literal("")),
    changeRequest: z.string().trim().max(255).optional().or(z.literal("")),
  })
  .refine((value) => Boolean(value.assetVulnerabilityId || value.cveId), {
    message: "A remediation task must target an asset vulnerability or a CVE.",
    path: ["assetVulnerabilityId"],
  });

export const updateRemediationTaskSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z
    .enum(["open", "assigned", "in_progress", "mitigated", "closed", "overdue"])
    .optional(),
  priority: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  businessPriority: z.enum(["p1", "p2", "p3", "p4", "p5"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  changeRequest: z.string().trim().max(255).optional().or(z.literal("")),
});

export async function listAssignableProfiles() {
  const db = getDb();

  if (!db) {
    return [] as AssignableProfileOption[];
  }

  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.status, "active"))
    .orderBy(profiles.fullName);

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName ?? row.email,
    email: row.email,
  }));
}

function computeTaskSlaStatus(input: {
  dueDate?: Date | null;
  status?: typeof remediationTasks.$inferSelect.status;
}) {
  if (!input.dueDate || input.status === "closed" || input.status === "mitigated") {
    return "on_track" as const;
  }

  const diff = input.dueDate.getTime() - Date.now();
  if (diff <= 0) {
    return "overdue" as const;
  }
  if (diff <= 3 * 24 * 60 * 60 * 1000) {
    return "at_risk" as const;
  }
  return "on_track" as const;
}

async function recordTaskEvent(input: {
  assetVulnerabilityId: string;
  eventType: typeof assetVulnerabilityEvents.$inferSelect.eventType;
  beforeStatus?: typeof assetVulnerabilities.$inferSelect.status | null;
  afterStatus?: typeof assetVulnerabilities.$inferSelect.status | null;
  riskScore?: number | null;
  businessPriority?: typeof assetVulnerabilities.$inferSelect.businessPriority | null;
  actorProfileId?: string | null;
  details?: Record<string, unknown>;
}) {
  const db = getDb();

  if (!db) {
    return;
  }

  await db.insert(assetVulnerabilityEvents).values({
    assetVulnerabilityId: input.assetVulnerabilityId,
    eventType: input.eventType,
    beforeStatus: input.beforeStatus ?? null,
    afterStatus: input.afterStatus ?? null,
    riskScore: input.riskScore ?? null,
    businessPriority: input.businessPriority ?? null,
    actorProfileId: input.actorProfileId ?? null,
    details: input.details ?? null,
  });
}

async function syncTaskAlerts(task: typeof remediationTasks.$inferSelect) {
  const db = getDb();

  if (!db) {
    return;
  }

  const taskScope = task.assetVulnerabilityId
    ? eq(alerts.relatedAssetVulnerabilityId, task.assetVulnerabilityId)
    : task.cveId
      ? eq(alerts.relatedCveId, task.cveId)
      : null;

  if (!taskScope) {
    return;
  }

  await db
    .update(alerts)
    .set({
      relatedRemediationTaskId: task.id,
    })
    .where(
      and(taskScope, isNull(alerts.relatedRemediationTaskId))
    );

  if (task.status === "assigned" || task.status === "in_progress") {
    await db
      .update(alerts)
      .set({
        status: "acknowledged",
        acknowledgedAt: new Date(),
      })
      .where(
        and(eq(alerts.relatedRemediationTaskId, task.id), eq(alerts.status, "new"))
      );
  }

  if (task.status === "mitigated" || task.status === "closed") {
    await db
      .update(alerts)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(alerts.relatedRemediationTaskId, task.id),
          ne(alerts.status, "resolved"),
          ne(alerts.status, "dismissed")
        )
      );
  }
}

export async function listRemediationTasks() {
  const db = getDb();

  if (!db) {
    return {
      tasks: [] as RemediationListItem[],
      assignableProfiles: [] as AssignableProfileOption[],
      summary: {
        openCount: 0,
        inProgressCount: 0,
        closedCount: 0,
        overdueCount: 0,
      },
    };
  }

  try {
    const [rows, assignableProfiles] = await Promise.all([
      db.select().from(remediationTasks).orderBy(desc(remediationTasks.updatedAt)),
      db
        .select({
          id: profiles.id,
          fullName: profiles.fullName,
          email: profiles.email,
        })
        .from(profiles)
        .where(eq(profiles.status, "active"))
        .orderBy(profiles.fullName),
    ]);

    const profileIds = Array.from(
      new Set(
        rows.flatMap((row) => [row.assignedTo, row.createdBy].filter(Boolean))
      )
    ) as string[];

    const avIds = rows
      .map((row) => row.assetVulnerabilityId)
      .filter((value): value is string => Boolean(value));
    const bulkCveIds = rows
      .map((row) => row.cveId)
      .filter((value): value is string => Boolean(value));

    const [profileRows, avRows, cveRows, bulkCounts] = await Promise.all([
      profileIds.length
        ? db
            .select({
              id: profiles.id,
              fullName: profiles.fullName,
            })
            .from(profiles)
            .where(inArray(profiles.id, profileIds))
        : [],
      avIds.length
        ? db
            .select({
              id: assetVulnerabilities.id,
              assetName: assets.name,
              assetCode: assets.assetCode,
              cveCode: cves.cveId,
            })
            .from(assetVulnerabilities)
            .leftJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
            .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
            .where(inArray(assetVulnerabilities.id, avIds))
        : [],
      bulkCveIds.length
        ? db
            .select({
              id: cves.id,
              cveCode: cves.cveId,
            })
            .from(cves)
            .where(inArray(cves.id, bulkCveIds))
        : [],
      bulkCveIds.length
        ? db
            .select({
              cveId: assetVulnerabilities.cveId,
            })
            .from(assetVulnerabilities)
            .where(inArray(assetVulnerabilities.cveId, bulkCveIds))
        : [],
    ]);

    const profileLookup = new Map(
      profileRows.map((row) => [row.id, row.fullName ?? "Unknown user"])
    );
    const avLookup = new Map(avRows.map((row) => [row.id, row]));
    const cveLookup = new Map(cveRows.map((row) => [row.id, row.cveCode]));
    const bulkCountLookup = bulkCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.cveId] = (acc[row.cveId] ?? 0) + 1;
      return acc;
    }, {});

    const tasks = rows
      .map((task) => {
        const avRow = task.assetVulnerabilityId
          ? avLookup.get(task.assetVulnerabilityId)
          : null;
        const cveCode =
          avRow?.cveCode ??
          (task.cveId ? cveLookup.get(task.cveId) : null) ??
          "—";
        const relatedAsset =
          avRow?.assetCode ??
          avRow?.assetName ??
          (cveCode !== "—" ? `${cveCode} campaign` : "Unlinked");
        const affectedAssetsCount = task.assetVulnerabilityId
          ? 1
          : task.cveId
            ? bulkCountLookup[task.cveId] ?? 0
            : 0;
        const assignedName =
          (task.assignedTo ? profileLookup.get(task.assignedTo) : null) ??
          "Unassigned";
        const createdByName =
          profileLookup.get(task.createdBy) ?? "Unknown creator";

        return {
          dbId: task.id,
          id: task.id,
          title: task.title,
          description: task.description ?? "",
          relatedCve: cveCode,
          relatedAsset,
          assignedOwner: assignedName ?? "Unassigned",
          assignedAvatar: getInitials(assignedName),
          assignedToId: task.assignedTo ?? null,
          createdById: task.createdBy,
          createdByName,
          assetVulnerabilityId: task.assetVulnerabilityId ?? null,
          cveDbId: task.cveId ?? null,
          dueDate: formatDate(task.dueDate),
          dueDateIso: task.dueDate?.toISOString() ?? null,
          slaStatus: toUiSlaStatus(task.slaStatus),
          status: toUiRemediationStatus(task.status),
          statusDb: task.status,
          priority: toUiSeverity(task.priority),
          priorityDb: task.priority,
          businessPriority: toUiBusinessPriority(task.businessPriority),
          businessPriorityDb: task.businessPriority,
          affectedAssetsCount,
          progress: task.progress,
          notes: task.notes ?? "",
          createdAt: formatDate(task.createdAt),
          updatedAt: formatDate(task.updatedAt),
          changeRequest: task.changeRequest ?? undefined,
        } satisfies RemediationListItem;
      })
      .sort((left, right) => {
        const leftRank = slaRank[left.slaStatus.toLowerCase().replace(" ", "_") as keyof typeof slaRank] ?? 0;
        const rightRank = slaRank[right.slaStatus.toLowerCase().replace(" ", "_") as keyof typeof slaRank] ?? 0;

        if (leftRank !== rightRank) {
          return rightRank - leftRank;
        }

        return left.dueDate.localeCompare(right.dueDate);
      });

    return {
      tasks,
      assignableProfiles: assignableProfiles.map((profile) => ({
        id: profile.id,
        fullName: profile.fullName ?? profile.email,
        email: profile.email,
      })),
      summary: {
        openCount: tasks.filter((task) => task.status === "Open" || task.status === "Assigned").length,
        inProgressCount: tasks.filter((task) => task.status === "In Progress").length,
        closedCount: tasks.filter((task) => task.status === "Closed").length,
        overdueCount: tasks.filter((task) => task.slaStatus === "Overdue").length,
      },
    };
  } catch {
    return {
      tasks: [] as RemediationListItem[],
      assignableProfiles: [] as AssignableProfileOption[],
      summary: {
        openCount: 0,
        inProgressCount: 0,
        closedCount: 0,
        overdueCount: 0,
      },
    };
  }
}

export async function createRemediationTask(
  input: z.input<typeof createRemediationTaskSchema>,
  createdBy: string
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Remediation writes are disabled until the database connection is configured."
    );
  }

  const parsed = createRemediationTaskSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(
      "validation_error",
      "Please correct the remediation task fields.",
      parsed.error.flatten().fieldErrors
    );
  }

  const [row] = await db
    .insert(remediationTasks)
    .values({
      ...parsed.data,
      description: parsed.data.description || null,
      assetVulnerabilityId: parsed.data.assetVulnerabilityId ?? null,
      cveId: parsed.data.cveId ?? null,
      assignedTo: parsed.data.assignedTo ?? null,
      dueDate: parsed.data.dueDate ?? null,
      slaStatus: computeTaskSlaStatus({
        dueDate: parsed.data.dueDate ?? null,
        status:
          parsed.data.status === "open" && parsed.data.assignedTo
            ? "assigned"
            : parsed.data.status,
      }),
      status:
        parsed.data.status === "open" && parsed.data.assignedTo
          ? "assigned"
          : parsed.data.status,
      notes: parsed.data.notes || null,
      changeRequest: parsed.data.changeRequest || null,
      createdBy,
    })
    .returning();

  await syncTaskAlerts(row);

  if (row.assetVulnerabilityId) {
    const [avRow] = await db
      .select({
        status: assetVulnerabilities.status,
        riskScore: assetVulnerabilities.riskScore,
        businessPriority: assetVulnerabilities.businessPriority,
      })
      .from(assetVulnerabilities)
      .where(eq(assetVulnerabilities.id, row.assetVulnerabilityId))
      .limit(1);

    if (avRow) {
      await recordTaskEvent({
        assetVulnerabilityId: row.assetVulnerabilityId,
        eventType: "task_linked",
        beforeStatus: avRow.status,
        afterStatus: avRow.status,
        riskScore: avRow.riskScore,
        businessPriority: avRow.businessPriority,
        actorProfileId: createdBy,
        details: {
          remediationTaskId: row.id,
          assignedTo: row.assignedTo,
          status: row.status,
        },
      });
    }
  }

  return row;
}

export async function getRemediationTask(taskId: string) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Remediation reads are disabled until the database connection is configured."
    );
  }

  const [row] = await db
    .select()
    .from(remediationTasks)
    .where(eq(remediationTasks.id, taskId))
    .limit(1);

  if (!row) {
    throw new AppError("not_found", "Remediation task not found.");
  }

  return row;
}

export async function updateRemediationTask(
  input: z.input<typeof updateRemediationTaskSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Remediation writes are disabled until the database connection is configured."
    );
  }

  const parsed = updateRemediationTaskSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(
      "validation_error",
      "Please correct the remediation task fields.",
      parsed.error.flatten().fieldErrors
    );
  }

  const current = await getRemediationTask(parsed.data.id);
  const nextStatus = parsed.data.status ?? current.status;
  const nextDueDate =
    parsed.data.dueDate === undefined ? current.dueDate : parsed.data.dueDate;
  const [row] = await db
    .update(remediationTasks)
    .set({
      assignedTo:
        parsed.data.assignedTo === undefined
          ? current.assignedTo
          : parsed.data.assignedTo,
      dueDate: nextDueDate ?? null,
      slaStatus: computeTaskSlaStatus({
        dueDate: nextDueDate ?? null,
        status: nextStatus,
      }),
      status: nextStatus,
      priority: parsed.data.priority ?? current.priority,
      businessPriority:
        parsed.data.businessPriority ?? current.businessPriority,
      progress:
        parsed.data.progress === undefined
          ? current.progress
          : parsed.data.progress,
      notes:
        parsed.data.notes === undefined ? current.notes : parsed.data.notes || null,
      changeRequest:
        parsed.data.changeRequest === undefined
          ? current.changeRequest
          : parsed.data.changeRequest || null,
      updatedAt: new Date(),
    })
    .where(eq(remediationTasks.id, parsed.data.id))
    .returning();

  await syncTaskAlerts(row);

  if (
    row.assetVulnerabilityId &&
    current.status !== row.status &&
    (row.status === "mitigated" || row.status === "closed")
  ) {
    const [avRow] = await db
      .select({
        status: assetVulnerabilities.status,
        riskScore: assetVulnerabilities.riskScore,
        businessPriority: assetVulnerabilities.businessPriority,
      })
      .from(assetVulnerabilities)
      .where(eq(assetVulnerabilities.id, row.assetVulnerabilityId))
      .limit(1);

    if (avRow) {
      await recordTaskEvent({
        assetVulnerabilityId: row.assetVulnerabilityId,
        eventType: "task_completed",
        beforeStatus: avRow.status,
        afterStatus: avRow.status,
        riskScore: avRow.riskScore,
        businessPriority: avRow.businessPriority,
        details: {
          remediationTaskId: row.id,
          previousTaskStatus: current.status,
          taskStatus: row.status,
        },
      });
    }
  }

  return row;
}

export async function updateRemediationStatus(
  taskId: string,
  status: typeof remediationTasks.$inferSelect.status
) {
  return updateRemediationTask({
    id: taskId,
    status,
  });
}
