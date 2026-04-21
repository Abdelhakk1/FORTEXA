import "server-only";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assetVulnerabilities, assets, cves, profiles, remediationTasks } from "@/db/schema";
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

export async function listRemediationTasks() {
  const db = getDb();

  if (!db) {
    return {
      tasks: [] as RemediationListItem[],
      summary: {
        openCount: 0,
        inProgressCount: 0,
        closedCount: 0,
        overdueCount: 0,
      },
    };
  }

  const rows = await db
    .select({
      task: remediationTasks,
      assignedName: profiles.fullName,
    })
    .from(remediationTasks)
    .leftJoin(profiles, eq(remediationTasks.assignedTo, profiles.id))
    .orderBy(desc(remediationTasks.updatedAt));

  const avIds = rows
    .map((row) => row.task.assetVulnerabilityId)
    .filter((value): value is string => Boolean(value));
  const bulkCveIds = rows
    .map((row) => row.task.cveId)
    .filter((value): value is string => Boolean(value));

  const [avRows, cveRows, bulkCounts] = await Promise.all([
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

  const avLookup = new Map(avRows.map((row) => [row.id, row]));
  const cveLookup = new Map(cveRows.map((row) => [row.id, row.cveCode]));
  const bulkCountLookup = bulkCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.cveId] = (acc[row.cveId] ?? 0) + 1;
    return acc;
  }, {});

  const tasks = rows
    .map(({ task, assignedName }) => {
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
        dueDate: formatDate(task.dueDate),
        slaStatus: toUiSlaStatus(task.slaStatus),
        status: toUiRemediationStatus(task.status),
        priority: toUiSeverity(task.priority),
        businessPriority: toUiBusinessPriority(task.businessPriority),
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
    summary: {
      openCount: tasks.filter((task) => task.status === "Open" || task.status === "Assigned").length,
      inProgressCount: tasks.filter((task) => task.status === "In Progress").length,
      closedCount: tasks.filter((task) => task.status === "Closed").length,
      overdueCount: tasks.filter((task) => task.slaStatus === "Overdue").length,
    },
  };
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
      notes: parsed.data.notes || null,
      changeRequest: parsed.data.changeRequest || null,
      createdBy,
    })
    .returning();

  return row;
}

export async function updateRemediationStatus(
  taskId: string,
  status: typeof remediationTasks.$inferSelect.status
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Remediation writes are disabled until the database connection is configured."
    );
  }

  const [row] = await db
    .update(remediationTasks)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(remediationTasks.id, taskId))
    .returning();

  if (!row) {
    throw new AppError("not_found", "Remediation task not found.");
  }

  return row;
}
