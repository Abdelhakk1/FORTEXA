import "server-only";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

interface AuditLogInput {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function getRequestAuditContext() {
  const requestHeaders = await headers();

  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

export async function logAuditEvent(input: AuditLogInput) {
  const db = getDb();

  if (!db) {
    return null;
  }

  const context =
    input.ipAddress || input.userAgent
      ? {
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        }
      : await getRequestAuditContext();

  const [row] = await db
    .insert(auditLogs)
    .values({
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })
    .returning();

  return row ?? null;
}
