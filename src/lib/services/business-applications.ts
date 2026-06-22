import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { businessApplications } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  ATM_PAYMENT_SERVICES_KEY,
  ATM_PAYMENT_SERVICES_LABEL,
} from "./business-priority";
import { recalculateRankV2ForAssetVulnerabilities } from "./rank-v2";

export type BusinessApplicationRecord =
  typeof businessApplications.$inferSelect;

export const atmPaymentServicesSettingsSchema = z.object({
  cidtConfidentiality: z.coerce.number().int().min(1).max(4),
  cidtIntegrity: z.coerce.number().int().min(1).max(4),
  cidtAvailability: z.coerce.number().int().min(1).max(4),
  cidtTraceability: z.coerce.number().int().min(1).max(4),
  isInternetExposed: z.boolean().default(false),
});

export async function ensureAtmPaymentServicesApplication(
  organizationId: string
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [existing] = await db
    .select()
    .from(businessApplications)
    .where(
      and(
        eq(businessApplications.organizationId, organizationId),
        eq(businessApplications.key, ATM_PAYMENT_SERVICES_KEY)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(businessApplications)
      .set({
        label: ATM_PAYMENT_SERVICES_LABEL,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, existing.id))
      .returning();

    return updated;
  }

  const [row] = await db
    .insert(businessApplications)
    .values({
      organizationId,
      key: ATM_PAYMENT_SERVICES_KEY,
      label: ATM_PAYMENT_SERVICES_LABEL,
      cidtConfidentiality: 4,
      cidtIntegrity: 4,
      cidtAvailability: 4,
      cidtTraceability: 4,
      isInternetExposed: false,
    })
    .returning();

  return row;
}

export async function getAtmPaymentServicesApplication(organizationId: string) {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(businessApplications)
    .where(
      and(
        eq(businessApplications.organizationId, organizationId),
        eq(businessApplications.key, ATM_PAYMENT_SERVICES_KEY)
      )
    )
    .limit(1);

  return existing ?? ensureAtmPaymentServicesApplication(organizationId);
}

export async function updateAtmPaymentServicesApplication(
  organizationId: string,
  input: z.input<typeof atmPaymentServicesSettingsSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = atmPaymentServicesSettingsSchema.parse(input);
  const current = await ensureAtmPaymentServicesApplication(organizationId);
  const [row] = await db
    .update(businessApplications)
    .set({
      label: ATM_PAYMENT_SERVICES_LABEL,
      cidtConfidentiality: parsed.cidtConfidentiality,
      cidtIntegrity: parsed.cidtIntegrity,
      cidtAvailability: parsed.cidtAvailability,
      cidtTraceability: parsed.cidtTraceability,
      isInternetExposed: parsed.isInternetExposed,
      updatedAt: new Date(),
    })
    .where(eq(businessApplications.id, current.id))
    .returning();

  await recalculateBusinessPrioritiesForOrganization(organizationId);

  return row;
}

export async function recalculateBusinessPrioritiesForOrganization(
  organizationId: string,
  options: { assetId?: string } = {}
) {
  await ensureAtmPaymentServicesApplication(organizationId);

  return recalculateRankV2ForAssetVulnerabilities({
    organizationId,
    assetId: options.assetId,
  });
}
