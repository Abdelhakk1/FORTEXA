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
  replyTo?: string;
}): Promise<ActionResult<{ id: string | null }>> {
  const resend = getResendClient();

  if (!resend) {
    return err(
      "service_unavailable",
      "RESEND_API_KEY is missing. Email notifications are currently disabled."
    );
  }

  if (!serverEnv.fortexaMailFrom) {
    return err(
      "service_unavailable",
      "FORTEXA_MAIL_FROM is missing. Email notifications are currently disabled."
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: serverEnv.fortexaMailFrom,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
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
