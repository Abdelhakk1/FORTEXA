import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assetVulnerabilities,
  assets,
  businessApplications,
  cves,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  ATM_PAYMENT_SERVICES_KEY,
  ATM_PAYMENT_SERVICES_LABEL,
  calculateBusinessPriority,
  resolveGabCidtContext,
} from "./business-priority";
import { ensureGabCidtTemplates } from "./gab-business-context";

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
  const db = getDb();

  if (!db) {
    return 0;
  }

  const application = await ensureAtmPaymentServicesApplication(organizationId);
  const templates = await ensureGabCidtTemplates(organizationId);
  const where = options.assetId
    ? and(
        eq(assetVulnerabilities.organizationId, organizationId),
        eq(assetVulnerabilities.assetId, options.assetId)
      )
    : eq(assetVulnerabilities.organizationId, organizationId);

  const rows = await db
    .select({
      av: assetVulnerabilities,
      asset: assets,
      cve: cves,
    })
    .from(assetVulnerabilities)
    .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
    .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .where(where);

  for (const row of rows) {
    const applicationCidt = {
      confidentiality: application.cidtConfidentiality,
      integrity: application.cidtIntegrity,
      availability: application.cidtAvailability,
      traceability: application.cidtTraceability,
    };
    const resolvedAssetCidt = resolveGabCidtContext({
      assetCidt: {
        confidentiality: row.asset.cidtConfidentiality,
        integrity: row.asset.cidtIntegrity,
        availability: row.asset.cidtAvailability,
        traceability: row.asset.cidtTraceability,
      },
      cidtOverrideEnabled: row.asset.cidtOverrideEnabled,
      cidtTemplateKey: row.asset.cidtTemplateKey,
      gabExposureType: row.asset.gabExposureType,
      templates,
      applicationCidt,
    });
    const score = calculateBusinessPriority({
      severity: row.cve.severity,
      cvssScore: row.cve.cvssScore ? Number(row.cve.cvssScore) : null,
      exploitMaturity: row.cve.exploitMaturity,
      assetCidt: resolvedAssetCidt.cidt,
      assetCidtSource: resolvedAssetCidt.source,
      assetCidtSourceLabel: resolvedAssetCidt.sourceLabel,
      assetCidtMissingContext: resolvedAssetCidt.missingContext,
      applicationCidt,
      applicationInternetExposed: application.isInternetExposed,
      gabExposureType: row.asset.gabExposureType,
    });

    await db
      .update(assetVulnerabilities)
      .set({
        riskScore: score.riskScore,
        businessPriority: score.businessPriority,
        priorityFactors: score.factors as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(assetVulnerabilities.id, row.av.id));
  }

  return rows.length;
}
