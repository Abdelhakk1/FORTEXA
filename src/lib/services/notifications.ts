import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  organizationMembers,
  organizationSettings,
  organizations,
  profiles,
} from "@/db/schema";
import { sendNotificationEmail } from "./resend";

export type NotificationKind =
  | "import_failure"
  | "task_assignment"
  | "sla_breach"
  | "ai_failure"
  | "daily_digest";

export type NotificationDispatchInput = {
  organizationId: string;
  kind: NotificationKind;
  subject: string;
  text: string;
  recipientProfileId?: string | null;
};

const notificationPreferenceByKind: Record<NotificationKind, string> = {
  import_failure: "importFailures",
  task_assignment: "taskAssignments",
  sla_breach: "slaBreaches",
  ai_failure: "aiFailures",
  daily_digest: "dailyDigest",
};

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function shouldSendNotification(
  notifications: Record<string, unknown> | null | undefined,
  kind: NotificationKind
) {
  const settings = notifications ?? {};
  const emailEnabled = readBoolean(settings.emailEnabled, false);
  const kindEnabled = readBoolean(
    settings[notificationPreferenceByKind[kind]],
    kind === "daily_digest" ? false : true
  );

  return emailEnabled && kindEnabled;
}

async function listRecipients(input: {
  organizationId: string;
  recipientProfileId?: string | null;
}) {
  const db = getDb();

  if (!db) {
    return [];
  }

  const rows = input.recipientProfileId
    ? await db
        .select({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
        })
        .from(profiles)
        .where(eq(profiles.id, input.recipientProfileId))
        .limit(1)
    : await db
        .select({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
        })
        .from(organizationMembers)
        .innerJoin(profiles, eq(organizationMembers.profileId, profiles.id))
        .where(
          and(
            eq(organizationMembers.organizationId, input.organizationId),
            eq(organizationMembers.status, "active"),
            inArray(organizationMembers.role, ["owner", "administrator"])
          )
        )
        .limit(20);

  return rows.filter((row) => row.email);
}

export async function dispatchOrganizationNotification(
  input: NotificationDispatchInput
) {
  const db = getDb();

  if (!db) {
    return { status: "skipped" as const, reason: "database_unavailable" };
  }

  const [row] = await db
    .select({
      organizationName: organizations.name,
      notifications: organizationSettings.notifications,
    })
    .from(organizations)
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organizations.id)
    )
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  if (!row) {
    return { status: "skipped" as const, reason: "organization_not_found" };
  }

  if (!shouldSendNotification(row.notifications, input.kind)) {
    return { status: "skipped" as const, reason: "notifications_disabled" };
  }

  const recipients = await listRecipients({
    organizationId: input.organizationId,
    recipientProfileId: input.recipientProfileId,
  });
  const emails = Array.from(new Set(recipients.map((recipient) => recipient.email)));

  if (emails.length === 0) {
    return { status: "skipped" as const, reason: "no_recipients" };
  }

  const sent = await sendNotificationEmail({
    to: emails,
    subject: input.subject,
    text: [
      input.text,
      "",
      `Organization: ${row.organizationName}`,
      "",
      "Fortexa",
    ].join("\n"),
  });

  if (!sent.ok) {
    return {
      status: "failed" as const,
      reason: sent.code,
      message: sent.message,
    };
  }

  return {
    status: "sent" as const,
    messageId: sent.data.id,
    recipients: emails.length,
  };
}
