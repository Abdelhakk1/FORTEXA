import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assetClassificationRules, assets, gabCidtTemplates } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  defaultGabCidtTemplates,
  gabCidtTemplateLabels,
  isDefaultGabCidtTemplateKey,
  normalizeGabExposureType,
  resolveGabCidtContext,
  toSensitivityLevel,
  calculateCidtSensitivity,
  type GabExposureType,
} from "./business-priority";

export type GabCidtTemplateRecord = typeof gabCidtTemplates.$inferSelect;
export type AssetClassificationRuleRecord =
  typeof assetClassificationRules.$inferSelect;

const cidtSettingSchema = z.coerce.number().int().min(1).max(4);

export const gabCidtTemplatesSettingsSchema = z.object({
  templates: z
    .array(
      z.object({
        templateKey: z.string().trim().min(1).max(120).optional(),
        label: z.string().trim().min(2).max(80),
        description: z.string().trim().max(240).optional().or(z.literal("")),
        isDefault: z.boolean().default(false),
        archived: z.boolean().default(false),
        cidtConfidentiality: cidtSettingSchema,
        cidtIntegrity: cidtSettingSchema,
        cidtAvailability: cidtSettingSchema,
        cidtTraceability: cidtSettingSchema,
      })
    )
    .min(2)
    .max(40),
});

export const assetClassificationRulesSettingsSchema = z.object({
  rules: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        field: z.enum(["hostname", "name", "asset_code", "branch", "location"]),
        matchValue: z.string().trim().min(1).max(120),
        gabExposureType: z
          .enum([
            "unknown",
            "indoor_agency",
            "outdoor_agency",
            "outdoor_commercial_center",
            "outdoor_public_street",
          ])
          .transform((value) => normalizeGabExposureType(value)),
        enabled: z.boolean().default(true),
      })
    )
    .max(20),
});

export const bulkAssetClassificationSchema = z.object({
  assetCodes: z.array(z.string().trim().min(1)).min(1).max(250),
  operation: z.enum([
    "set_exposure",
    "apply_template",
    "clear_custom_override",
    "clear_template",
    "copy_cidt_from_asset",
  ]),
  gabExposureType: z
    .enum([
      "unknown",
      "indoor_agency",
      "outdoor_agency",
      "outdoor_commercial_center",
      "outdoor_public_street",
    ])
    .transform((value) => normalizeGabExposureType(value))
    .optional(),
  cidtTemplateKey: z.string().trim().min(1).max(120).optional(),
  sourceAssetCode: z.string().trim().min(1).optional(),
});

export function templateDisplayRows(templates: GabCidtTemplateRecord[]) {
  return templates
    .filter((template) => !template.archivedAt)
    .filter((template) => template.templateKey !== "outdoor_public_commercial")
    .map((template) => {
      const sensitivity = calculateCidtSensitivity({
        confidentiality: template.cidtConfidentiality,
        integrity: template.cidtIntegrity,
        availability: template.cidtAvailability,
        traceability: template.cidtTraceability,
      });

      return {
        ...template,
        sensitivity: toSensitivityLevel(sensitivity),
      };
    });
}

function normalizeTemplatesForInsert(organizationId: string) {
  return defaultGabCidtTemplates.map((template) => ({
    organizationId,
    templateKey: template.templateKey,
    label: template.label,
    description: template.description,
    isDefault: true,
    cidtConfidentiality: template.cidtConfidentiality,
    cidtIntegrity: template.cidtIntegrity,
    cidtAvailability: template.cidtAvailability,
    cidtTraceability: template.cidtTraceability,
  }));
}

function slugifyTemplateKey(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  return `custom_${slug || randomUUID().slice(0, 8)}`;
}

async function uniqueCustomTemplateKey(organizationId: string, label: string) {
  const db = getDb();
  const base = slugifyTemplateKey(label);

  if (!db) {
    return base;
  }

  let candidate = base;
  let suffix = 2;

  while (true) {
    const [existing] = await db
      .select({ id: gabCidtTemplates.id })
      .from(gabCidtTemplates)
      .where(
        and(
          eq(gabCidtTemplates.organizationId, organizationId),
          eq(gabCidtTemplates.templateKey, candidate)
        )
      )
      .limit(1);

    if (!existing) {
      return candidate;
    }

    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
}

export async function ensureGabCidtTemplates(organizationId: string) {
  const db = getDb();

  if (!db) {
    return [];
  }

  const rows = await db
    .select()
    .from(gabCidtTemplates)
    .where(eq(gabCidtTemplates.organizationId, organizationId));
  const existingKeys = new Set(rows.map((row) => row.templateKey));
  const missing = normalizeTemplatesForInsert(organizationId).filter(
    (template) => !existingKeys.has(template.templateKey)
  );

  if (missing.length > 0) {
    await db.insert(gabCidtTemplates).values(missing).onConflictDoNothing();
  }

  for (const template of defaultGabCidtTemplates) {
    await db
      .update(gabCidtTemplates)
      .set({
        label: template.label,
        description: template.description,
        isDefault: true,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gabCidtTemplates.organizationId, organizationId),
          eq(gabCidtTemplates.templateKey, template.templateKey)
        )
      );
  }

  return db
    .select()
    .from(gabCidtTemplates)
    .where(
      and(
        eq(gabCidtTemplates.organizationId, organizationId),
        isNull(gabCidtTemplates.archivedAt)
      )
    )
    .orderBy(asc(gabCidtTemplates.templateKey));
}

export async function updateGabCidtTemplates(
  organizationId: string,
  input: z.input<typeof gabCidtTemplatesSettingsSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = gabCidtTemplatesSettingsSchema.parse(input);
  await ensureGabCidtTemplates(organizationId);

  const existing = await db
    .select()
    .from(gabCidtTemplates)
    .where(eq(gabCidtTemplates.organizationId, organizationId));
  const existingByKey = new Map(existing.map((template) => [template.templateKey, template]));

  for (const template of parsed.templates) {
    const templateKey =
      template.templateKey && !template.templateKey.startsWith("draft-")
        ? template.templateKey
        : await uniqueCustomTemplateKey(organizationId, template.label);
    const isDefault = isDefaultGabCidtTemplateKey(templateKey);
    const normalizedLabel = isDefault
      ? gabCidtTemplateLabels[templateKey]
      : template.label.trim();
    const duplicateLabel = existing.find(
      (row) =>
        row.templateKey !== templateKey &&
        !row.archivedAt &&
        row.label.toLowerCase() === normalizedLabel.toLowerCase()
    );

    if (duplicateLabel) {
      throw new AppError(
        "validation_error",
        `Template name "${normalizedLabel}" is already used.`
      );
    }

    if (template.archived) {
      if (isDefault) {
        throw new AppError("validation_error", "Default templates cannot be removed.");
      }

      const [activeUse] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, organizationId),
            eq(assets.cidtTemplateKey, templateKey)
          )
        )
        .limit(1);

      if (activeUse) {
        await db
          .update(gabCidtTemplates)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(gabCidtTemplates.organizationId, organizationId),
              eq(gabCidtTemplates.templateKey, templateKey)
            )
          );
      } else {
        await db
          .delete(gabCidtTemplates)
          .where(
            and(
              eq(gabCidtTemplates.organizationId, organizationId),
              eq(gabCidtTemplates.templateKey, templateKey)
            )
          );
      }

      continue;
    }

    const values = {
      label: normalizedLabel,
      description:
        template.description?.trim() ||
        (isDefault
          ? defaultGabCidtTemplates.find((row) => row.templateKey === templateKey)
              ?.description ?? null
          : null),
      isDefault,
      archivedAt: null,
      cidtConfidentiality: template.cidtConfidentiality,
      cidtIntegrity: template.cidtIntegrity,
      cidtAvailability: template.cidtAvailability,
      cidtTraceability: template.cidtTraceability,
      updatedAt: new Date(),
    };

    if (existingByKey.has(templateKey)) {
      await db
        .update(gabCidtTemplates)
        .set(values)
        .where(
          and(
            eq(gabCidtTemplates.organizationId, organizationId),
            eq(gabCidtTemplates.templateKey, templateKey)
          )
        );
      continue;
    }

    await db
      .insert(gabCidtTemplates)
      .values({
        organizationId,
        templateKey,
        ...values,
      })
      .onConflictDoNothing();
  }

  return ensureGabCidtTemplates(organizationId);
}

export async function listAssetClassificationRules(organizationId: string) {
  const db = getDb();

  if (!db) {
    return [];
  }

  return db
    .select()
    .from(assetClassificationRules)
    .where(eq(assetClassificationRules.organizationId, organizationId))
    .orderBy(asc(assetClassificationRules.sortOrder), asc(assetClassificationRules.name));
}

export async function replaceAssetClassificationRules(
  organizationId: string,
  input: z.input<typeof assetClassificationRulesSettingsSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = assetClassificationRulesSettingsSchema.parse(input);
  const usedRuleNames = new Set<string>();
  const normalizedRules = parsed.rules.map((rule) => {
    const baseName = rule.name.trim();
    let name = baseName;
    let suffix = 2;

    while (usedRuleNames.has(name.toLowerCase())) {
      name = `${baseName} (${suffix})`;
      suffix += 1;
    }

    usedRuleNames.add(name.toLowerCase());

    return {
      ...rule,
      name,
      matchValue: rule.matchValue.trim(),
    };
  });

  await db
    .delete(assetClassificationRules)
    .where(eq(assetClassificationRules.organizationId, organizationId));

  if (normalizedRules.length > 0) {
    await db.insert(assetClassificationRules).values(
      normalizedRules.map((rule, index) => ({
        organizationId,
        name: rule.name,
        field: rule.field,
        matchOperator: "contains",
        matchValue: rule.matchValue,
        gabExposureType: rule.gabExposureType,
        enabled: rule.enabled,
        sortOrder: index,
      }))
    );
  }

  return listAssetClassificationRules(organizationId);
}

export async function applyAssetClassificationRulesToUnknownAssets(
  organizationId: string
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [rules, unknownAssets] = await Promise.all([
    listAssetClassificationRules(organizationId),
    db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          eq(assets.gabExposureType, "unknown")
        )
      ),
  ]);
  let classified = 0;
  const now = new Date();

  for (const asset of unknownAssets) {
    const classification = classifyAssetByRules(
      {
        preferredAssetCode: asset.assetCode,
        name: asset.name,
        hostname:
          typeof asset.metadata?.hostname === "string"
            ? asset.metadata.hostname
            : asset.name,
        branch: asset.branch,
        location: asset.location,
      },
      rules
    );

    if (!classification) {
      continue;
    }

    await db
      .update(assets)
      .set({
        gabExposureType: classification.gabExposureType,
        metadata: {
          ...(asset.metadata ?? {}),
          classification: {
            source: "settings_rule",
            ruleName: classification.ruleName,
            appliedAt: now.toISOString(),
          },
        },
        updatedAt: now,
      })
      .where(eq(assets.id, asset.id));
    classified += 1;
  }

  return classified;
}

export function classifyAssetByRules(
  asset: {
    preferredAssetCode?: string | null;
    name?: string | null;
    hostname?: string | null;
    branch?: string | null;
    location?: string | null;
  },
  rules: Array<{
    field: string;
    matchValue: string;
    gabExposureType: string;
    enabled: boolean;
    name?: string | null;
  }>
): { gabExposureType: GabExposureType; ruleName: string } | null {
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    const fieldValue =
      rule.field === "hostname"
        ? asset.hostname
        : rule.field === "name"
          ? asset.name
          : rule.field === "asset_code"
            ? asset.preferredAssetCode
            : rule.field === "branch"
              ? asset.branch
              : rule.field === "location"
                ? asset.location
                : null;

    if (
      fieldValue &&
      fieldValue.toLowerCase().includes(rule.matchValue.toLowerCase())
    ) {
      return {
        gabExposureType: normalizeGabExposureType(rule.gabExposureType),
        ruleName: rule.name ?? rule.matchValue,
      };
    }
  }

  return null;
}

export async function bulkUpdateAssetClassification(
  organizationId: string,
  input: z.input<typeof bulkAssetClassificationSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = bulkAssetClassificationSchema.parse(input);
  const targetAssets = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.organizationId, organizationId),
        inArray(assets.assetCode, parsed.assetCodes)
      )
    );

  if (targetAssets.length === 0) {
    throw new AppError("not_found", "No matching GABs were found.");
  }

  if (
    parsed.operation === "set_exposure" &&
    !parsed.gabExposureType
  ) {
    throw new AppError("validation_error", "Choose a GAB exposure type.");
  }

  if (parsed.operation === "apply_template" && !parsed.cidtTemplateKey) {
    throw new AppError("validation_error", "Choose a GAB CIDT template.");
  }

  if (parsed.operation === "copy_cidt_from_asset" && !parsed.sourceAssetCode) {
    throw new AppError("validation_error", "Choose a source GAB.");
  }

  let sourceCidt: {
    cidtConfidentiality: number;
    cidtIntegrity: number;
    cidtAvailability: number;
    cidtTraceability: number;
  } | null = null;

  if (parsed.operation === "copy_cidt_from_asset") {
    const templates = await ensureGabCidtTemplates(organizationId);
    const [source] = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          eq(assets.assetCode, parsed.sourceAssetCode!)
        )
      )
      .limit(1);

    if (!source) {
      throw new AppError("not_found", "Source GAB was not found.");
    }

    const resolved = resolveGabCidtContext({
      assetCidt: {
        confidentiality: source.cidtConfidentiality,
        integrity: source.cidtIntegrity,
        availability: source.cidtAvailability,
        traceability: source.cidtTraceability,
      },
      cidtOverrideEnabled: source.cidtOverrideEnabled,
      gabExposureType: source.gabExposureType,
      templates,
      cidtTemplateKey: source.cidtTemplateKey,
      applicationCidt: null,
    });

    sourceCidt = {
      cidtConfidentiality: resolved.cidt.confidentiality,
      cidtIntegrity: resolved.cidt.integrity,
      cidtAvailability: resolved.cidt.availability,
      cidtTraceability: resolved.cidt.traceability,
    };
  }

  const now = new Date();

  for (const asset of targetAssets) {
    if (parsed.operation === "set_exposure") {
      await db
        .update(assets)
        .set({
          gabExposureType: parsed.gabExposureType!,
          updatedAt: now,
        })
        .where(eq(assets.id, asset.id));
      continue;
    }

    if (parsed.operation === "apply_template") {
      await db
        .update(assets)
        .set({
          cidtTemplateKey: parsed.cidtTemplateKey!,
          cidtOverrideEnabled: false,
          cidtConfidentiality: null,
          cidtIntegrity: null,
          cidtAvailability: null,
          cidtTraceability: null,
          updatedAt: now,
        })
        .where(eq(assets.id, asset.id));
      continue;
    }

    if (parsed.operation === "clear_template") {
      await db
        .update(assets)
        .set({
          cidtTemplateKey: null,
          updatedAt: now,
        })
        .where(eq(assets.id, asset.id));
      continue;
    }

    if (parsed.operation === "clear_custom_override") {
      await db
        .update(assets)
        .set({
          cidtOverrideEnabled: false,
          cidtConfidentiality: null,
          cidtIntegrity: null,
          cidtAvailability: null,
          cidtTraceability: null,
          updatedAt: now,
        })
        .where(eq(assets.id, asset.id));
      continue;
    }

    if (sourceCidt) {
      await db
        .update(assets)
        .set({
          ...sourceCidt,
          cidtOverrideEnabled: true,
          updatedAt: now,
        })
        .where(eq(assets.id, asset.id));
    }
  }

  return targetAssets.length;
}
