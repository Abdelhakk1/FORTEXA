import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  organizationMembers,
  organizationSettings,
  organizations,
  profiles,
  roles,
  sites,
} from "@/db/schema";
import type { VerifiedAuthUser } from "@/lib/auth/identity";
import { AppError } from "@/lib/errors";
import {
  FIRST_DATA_VALUES,
  OPERATIONAL_CONSTRAINT_VALUES,
  PRIMARY_ENVIRONMENT_VALUES,
  REMEDIATION_OWNERSHIP_VALUES,
  REMEDIATION_POLICY_PRESET_MAP,
  REMEDIATION_POLICY_VALUES,
  TEAM_TYPE_VALUES,
} from "@/lib/onboarding-flow";

export type OrganizationRecord = typeof organizations.$inferSelect;
export type OrganizationSettingsRecord =
  typeof organizationSettings.$inferSelect;
export type OrganizationMemberRecord = typeof organizationMembers.$inferSelect;
export type SiteRecord = typeof sites.$inferSelect;

export interface ActiveOrganizationContext {
  organization: OrganizationRecord;
  membership: OrganizationMemberRecord;
  settings: OrganizationSettingsRecord;
}

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const organizationProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the organization name.")
    .max(120, "Keep the organization name under 120 characters."),
  companyType: z.enum([
    "bank",
    "atm_operator",
    "branch_network",
    "mssp",
    "bank_security",
    "managed_security_provider",
    "internal_security",
    "other",
  ]),
  defaultRegion: z.string().trim().max(120).optional().or(z.literal("")),
  defaultCountry: z.string().trim().max(120).optional().or(z.literal("")),
  timezone: z
    .string()
    .trim()
    .min(2, "Choose a timezone.")
    .max(80)
    .refine(isValidTimeZone, "Choose a valid IANA timezone."),
});

export const operatingContextSchema = z.object({
  atmGabFleet: z.boolean().default(true),
  vendorManagedSystems: z.boolean().default(false),
  primaryEnvironment: z.enum(PRIMARY_ENVIRONMENT_VALUES).optional(),
  remediationOwnership: z.enum(REMEDIATION_OWNERSHIP_VALUES).optional(),
  operationalConstraints: z
    .array(z.enum(OPERATIONAL_CONSTRAINT_VALUES))
    .max(3)
    .optional(),
});

export const workspaceOnboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the organization name.")
    .max(120, "Keep the organization name under 120 characters."),
  teamType: z.enum(TEAM_TYPE_VALUES, {
    error: "Choose the team type closest to your workflow.",
  }),
  timezone: z
    .string()
    .trim()
    .min(2, "Choose a timezone.")
    .max(80)
    .refine(isValidTimeZone, "Choose a valid IANA timezone."),
});

export const environmentOnboardingSchema = z.object({
  primaryEnvironment: z.enum(PRIMARY_ENVIRONMENT_VALUES, {
    error: "Choose your primary operating environment.",
  }),
  remediationOwnership: z.enum(REMEDIATION_OWNERSHIP_VALUES, {
    error: "Choose who usually owns remediation.",
  }),
  operationalConstraints: z
    .array(z.enum(OPERATIONAL_CONSTRAINT_VALUES))
    .max(3, "Choose up to 3 constraints.")
    .default([]),
});

export const remediationPolicyOnboardingSchema = z.object({
  preset: z.enum(REMEDIATION_POLICY_VALUES, {
    error: "Choose a remediation posture.",
  }),
  slaBreachAlertsEnabled: z.boolean().default(true),
});

export const firstDataChoiceSchema = z.object({
  firstDataChoice: z.enum(FIRST_DATA_VALUES).default("skip"),
});

export const siteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a coverage area name.")
    .max(120, "Keep the coverage area name under 120 characters."),
  code: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters for the short code.")
    .max(32, "Keep the short code under 32 characters."),
  siteType: z.enum(["atm_fleet", "regional_group"]),
  regionName: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(255).optional().or(z.literal("")),
  timezone: z.string().trim().max(80).optional().or(z.literal("")),
  vendorManaged: z.boolean().default(false),
});

export const slaPolicySchema = z.object({
  criticalDays: z.coerce.number().int().min(1).max(365),
  highDays: z.coerce.number().int().min(1).max(365),
  mediumDays: z.coerce.number().int().min(1).max(365),
  lowDays: z.coerce.number().int().min(1).max(365),
});

export const aiSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  consentAccepted: z.boolean().default(false),
  dataPolicy: z.enum(["minimal_evidence", "scanner_evidence", "disabled"]),
});

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean().default(false),
  importFailures: z.boolean().default(true),
  taskAssignments: z.boolean().default(true),
  slaBreaches: z.boolean().default(true),
  aiFailures: z.boolean().default(true),
  dailyDigest: z.boolean().default(false),
});

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "fortexa-org"
  );
}

function defaultSettingsValues(organizationId: string) {
  return {
    organizationId,
    operatingContext: {
      atmGabFleet: true,
      vendorManagedSystems: false,
      primaryEnvironment: "atm_gab_devices",
      remediationOwnership: "we_remediate_directly",
      operationalConstraints: [],
      remediationPolicyPreset: "standard",
    },
    slaCriticalDays: 7,
    slaHighDays: 14,
    slaMediumDays: 30,
    slaLowDays: 90,
    aiEnabled: false,
    aiConsentAccepted: false,
    aiDataPolicy: "minimal_evidence",
    notifications: {
      emailEnabled: false,
      importFailures: true,
      taskAssignments: true,
      slaBreaches: true,
      aiFailures: true,
      dailyDigest: false,
    },
    scannerSettings: {
      nessus: true,
      openvas: false,
      nmap: false,
      qualys: false,
    },
  } satisfies typeof organizationSettings.$inferInsert;
}

function mergeOnboardingMetadata(
  patch: Record<string, unknown> | undefined
) {
  if (!patch) {
    return undefined;
  }

  return sql<Record<string, unknown>>`jsonb_set(
    coalesce(${organizations.metadata}, '{}'::jsonb),
    '{onboarding}',
    coalesce(${organizations.metadata}->'onboarding', '{}'::jsonb) || ${JSON.stringify(
      patch
    )}::jsonb,
    true
  )`;
}

function deriveLegacyContext(
  input: z.infer<typeof environmentOnboardingSchema>
) {
  return {
    atmGabFleet:
      input.primaryEnvironment === "atm_gab_devices" ||
      input.primaryEnvironment === "atm_gab_branch_systems",
    vendorManagedSystems:
      input.remediationOwnership === "vendor_remediates" ||
      input.remediationOwnership === "shared_internal_vendor" ||
      input.primaryEnvironment === "customer_managed_environments",
  };
}

async function ensureAdministratorRole() {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [existing] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "administrator"))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(roles)
    .values({
      name: "administrator",
      description: "Full Fortexa administrator",
      permissions: {},
    })
    .returning();

  return created;
}

export async function ensureProfileForUser(user: VerifiedAuthUser) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(profiles)
    .values({
      id: user.id,
      fullName: user.email ?? "Fortexa User",
      email: user.email ?? `${user.id}@fortexa.local`,
      status: "active",
    })
    .returning();

  return created;
}

export async function ensureOrganizationSettings(organizationId: string) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const values = defaultSettingsValues(organizationId);
  const [row] = await db
    .insert(organizationSettings)
    .values(values)
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function getActiveOrganizationForUser(
  userId: string
): Promise<ActiveOrganizationContext | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [row] = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
      settings: organizationSettings,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organizations.id)
    )
    .where(
      and(
        eq(organizationMembers.profileId, userId),
        eq(organizationMembers.status, "active")
      )
    )
    .orderBy(organizationMembers.createdAt)
    .limit(1);

  if (!row) {
    return null;
  }

  const settings =
    row.settings ?? (await ensureOrganizationSettings(row.organization.id));

  return {
    organization: row.organization,
    membership: row.membership,
    settings,
  };
}

export async function listOrganizationSites(organizationId: string) {
  const db = getDb();

  if (!db) {
    return [] as SiteRecord[];
  }

  try {
    return await db
      .select()
      .from(sites)
      .where(eq(sites.organizationId, organizationId))
      .orderBy(sites.name);
  } catch {
    return [] as SiteRecord[];
  }
}

export async function listOrganizationMembers(organizationId: string, limit = 50) {
  const db = getDb();

  if (!db) {
    return [];
  }

  try {
    return await db
      .select({
        id: organizationMembers.id,
        profileId: organizationMembers.profileId,
        role: organizationMembers.role,
        status: organizationMembers.status,
        fullName: profiles.fullName,
        email: profiles.email,
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .leftJoin(profiles, eq(organizationMembers.profileId, profiles.id))
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(organizationMembers.createdAt)
      .limit(limit);
  } catch {
    return [];
  }
}

export async function listOrganizationAuditEvents(
  organizationId: string,
  limit = 8
) {
  const db = getDb();

  if (!db) {
    return [];
  }

  try {
    return await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        createdAt: auditLogs.createdAt,
        actorName: profiles.fullName,
        actorEmail: profiles.email,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function createOrganizationForUser(
  user: VerifiedAuthUser,
  input: z.input<typeof organizationProfileSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = organizationProfileSchema.parse(input);
  const profile = await ensureProfileForUser(user);
  const adminRole = await ensureAdministratorRole();
  const slugBase = slugify(parsed.name);
  const slug = `${slugBase}-${user.id.slice(0, 8)}`;

  const [organization] = await db
    .insert(organizations)
    .values({
      name: parsed.name,
      slug,
      companyType: parsed.companyType,
      defaultRegion: parsed.defaultRegion || null,
      defaultCountry: parsed.defaultCountry || null,
      timezone: parsed.timezone,
      onboardingStep: "environment",
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: parsed.name,
        companyType: parsed.companyType,
        defaultRegion: parsed.defaultRegion || null,
        defaultCountry: parsed.defaultCountry || null,
        timezone: parsed.timezone,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(profiles)
    .set({
      roleId: profile.roleId ?? adminRole.id,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  await db
    .insert(organizationMembers)
    .values({
      organizationId: organization.id,
      profileId: profile.id,
      role: "owner",
      status: "active",
    })
    .onConflictDoNothing();

  await ensureOrganizationSettings(organization.id);

  return organization;
}

export async function updateOrganizationProfile(
  organizationId: string,
  input: z.input<typeof organizationProfileSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = organizationProfileSchema.parse(input);
  const [row] = await db
    .update(organizations)
    .set({
      name: parsed.name,
      companyType: parsed.companyType,
      defaultRegion: parsed.defaultRegion || null,
      defaultCountry: parsed.defaultCountry || null,
      timezone: parsed.timezone,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return row;
}

export async function updateOperatingContext(
  organizationId: string,
  input: z.input<typeof operatingContextSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = operatingContextSchema.parse(input);
  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      operatingContext: parsed,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        operatingContext: parsed,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function updateOnboardingEnvironment(
  organizationId: string,
  input: z.input<typeof environmentOnboardingSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = environmentOnboardingSchema.parse(input);
  const current = await ensureOrganizationSettings(organizationId);
  const operatingContext = {
    ...(current.operatingContext ?? {}),
    ...deriveLegacyContext(parsed),
    primaryEnvironment: parsed.primaryEnvironment,
    remediationOwnership: parsed.remediationOwnership,
    operationalConstraints: parsed.operationalConstraints,
  };

  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      operatingContext,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        operatingContext,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function upsertSite(
  organizationId: string,
  input: z.input<typeof siteSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = siteSchema.parse(input);
  const code = parsed.code.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "-");
  const [row] = await db
    .insert(sites)
    .values({
      organizationId,
      name: parsed.name,
      code,
      siteType: parsed.siteType,
      regionName: parsed.regionName || null,
      country: parsed.country || null,
      location: parsed.location || null,
      timezone: parsed.timezone || null,
      vendorManaged: parsed.vendorManaged,
    })
    .onConflictDoUpdate({
      target: [sites.organizationId, sites.code],
      set: {
        name: parsed.name,
        siteType: parsed.siteType,
        regionName: parsed.regionName || null,
        country: parsed.country || null,
        location: parsed.location || null,
        timezone: parsed.timezone || null,
        vendorManaged: parsed.vendorManaged,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function updateSlaPolicy(
  organizationId: string,
  input: z.input<typeof slaPolicySchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = slaPolicySchema.parse(input);
  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      slaCriticalDays: parsed.criticalDays,
      slaHighDays: parsed.highDays,
      slaMediumDays: parsed.mediumDays,
      slaLowDays: parsed.lowDays,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        slaCriticalDays: parsed.criticalDays,
        slaHighDays: parsed.highDays,
        slaMediumDays: parsed.mediumDays,
        slaLowDays: parsed.lowDays,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function updateRemediationPolicyPreset(
  organizationId: string,
  input: z.input<typeof remediationPolicyOnboardingSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = remediationPolicyOnboardingSchema.parse(input);
  const preset = REMEDIATION_POLICY_PRESET_MAP[parsed.preset];
  const current = await ensureOrganizationSettings(organizationId);
  const operatingContext = {
    ...(current.operatingContext ?? {}),
    remediationPolicyPreset: parsed.preset,
  };
  const notifications = {
    ...(current.notifications ?? {}),
    slaBreaches: parsed.slaBreachAlertsEnabled,
  };

  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      operatingContext,
      notifications,
      slaCriticalDays: preset.dueDays.critical,
      slaHighDays: preset.dueDays.high,
      slaMediumDays: preset.dueDays.medium,
      slaLowDays: preset.dueDays.low,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        operatingContext,
        notifications,
        slaCriticalDays: preset.dueDays.critical,
        slaHighDays: preset.dueDays.high,
        slaMediumDays: preset.dueDays.medium,
        slaLowDays: preset.dueDays.low,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function updateAiSettings(
  organizationId: string,
  input: z.input<typeof aiSettingsSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = aiSettingsSchema.parse(input);
  const enabled = parsed.enabled && parsed.consentAccepted;
  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      aiEnabled: enabled,
      aiConsentAccepted: parsed.consentAccepted,
      aiDataPolicy: parsed.dataPolicy,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        aiEnabled: enabled,
        aiConsentAccepted: parsed.consentAccepted,
        aiDataPolicy: parsed.dataPolicy,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function updateNotificationSettings(
  organizationId: string,
  input: z.input<typeof notificationSettingsSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = notificationSettingsSchema.parse(input);
  const [row] = await db
    .insert(organizationSettings)
    .values({
      ...defaultSettingsValues(organizationId),
      notifications: parsed,
    })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: {
        notifications: parsed,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function completeOrganizationOnboarding(
  organizationId: string,
  input?: z.input<typeof firstDataChoiceSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = firstDataChoiceSchema.parse(input ?? {});
  const metadataPatch = mergeOnboardingMetadata({
    first_data_choice: parsed.firstDataChoice,
    completed_without_data: parsed.firstDataChoice === "skip",
    first_data_completed_at: new Date().toISOString(),
  });
  const updateValues: Record<string, unknown> = {
    onboardingCompleted: true,
    onboardingStep: "complete",
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  if (metadataPatch) {
    updateValues.metadata = metadataPatch;
  }

  const [row] = await db
    .update(organizations)
    .set(updateValues)
    .where(eq(organizations.id, organizationId))
    .returning();

  return row;
}

export async function setOnboardingStep(
  organizationId: string,
  step: string,
  onboardingMetadata?: Record<string, unknown>
) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const metadataPatch = mergeOnboardingMetadata(onboardingMetadata);
  const updateValues: Record<string, unknown> = {
    onboardingStep: step,
    updatedAt: new Date(),
  };

  if (metadataPatch) {
    updateValues.metadata = metadataPatch;
  }

  await db
    .update(organizations)
    .set(updateValues)
    .where(eq(organizations.id, organizationId));
}
