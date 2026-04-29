import "server-only";

import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult } from "@/lib/errors";

let resendClient: Resend | null = null;

function getResendClient() {
  if (!serverEnv.resendApiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(serverEnv.resendApiKey);
  }

  return resendClient;
}

export async function sendNotificationEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<ActionResult<{ id: string | null }>> {
  const resend = getResendClient();

  if (!resend) {
    return err(
      "service_unavailable",
      "RESEND_API_KEY is missing. Email notifications are currently disabled."
    );
  }

  if (!serverEnv.resendFromEmail) {
    return err(
      "service_unavailable",
      "RESEND_FROM_EMAIL is missing. Email notifications are currently disabled."
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: serverEnv.resendFromEmail,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      return err("server_error", error.message);
    }

    return ok({ id: data?.id ?? null });
  } catch (error) {
    Sentry.captureException(error);
    return err(
      "server_error",
      "Resend failed to queue the email. The event has been captured for review."
    );
  }
}

export function hasResendEmailConfig(input: {
  resendApiKey?: string;
  fromEmail?: string;
}) {
  return Boolean(input.resendApiKey && input.fromEmail);
}

export function isResendEmailConfigured() {
  return hasResendEmailConfig({
    resendApiKey: serverEnv.resendApiKey,
    fromEmail: serverEnv.resendFromEmail,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTeamInviteEmail(input: {
  organizationName: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  const expirationDate = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(input.expiresAt);

  return {
    subject: "You’ve been invited to Fortexa",
    text: [
      `You have been invited to join ${input.organizationName} on Fortexa.`,
      "",
      `Role: ${input.roleLabel}`,
      `Accept invite: ${input.inviteLink}`,
      `Expires: ${expirationDate}`,
      "",
      "Fortexa",
    ].join("\n"),
    html: [
      "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#1A1A2E\">",
      "<h1 style=\"font-size:20px;margin:0 0 12px\">You’ve been invited to Fortexa</h1>",
      `<p style=\"margin:0 0 12px\">You have been invited to join <strong>${escapeHtml(input.organizationName)}</strong>.</p>`,
      `<p style=\"margin:0 0 12px\">Role: <strong>${escapeHtml(input.roleLabel)}</strong></p>`,
      `<p style=\"margin:0 0 16px\">This invite expires on ${escapeHtml(expirationDate)}.</p>`,
      `<p style=\"margin:0 0 16px\"><a href=\"${escapeHtml(input.inviteLink)}\" style=\"background:#0C5CAB;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700\">Accept invite</a></p>`,
      `<p style=\"margin:0;color:#6B7280;font-size:13px\">If the button does not work, paste this link into your browser:<br>${escapeHtml(input.inviteLink)}</p>`,
      "</div>",
    ].join(""),
  };
}

export async function sendTeamInviteEmail(input: {
  to: string;
  organizationName: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  const email = buildTeamInviteEmail(input);

  return sendNotificationEmail({
    to: input.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
