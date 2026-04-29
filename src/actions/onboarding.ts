"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { getCurrentUser, requireActiveOrganization } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  completeOrganizationOnboarding,
  createOrganizationForUser,
  environmentOnboardingSchema,
  firstDataChoiceSchema,
  getActiveOrganizationForUser,
  remediationPolicyOnboardingSchema,
  setOnboardingStep,
  updateOnboardingEnvironment,
  updateOrganizationProfile,
  updateRemediationPolicyPreset,
  workspaceOnboardingSchema,
} from "@/lib/services/organizations";
import { importAssetsFromCsv } from "@/lib/services/ingestion";

export async function saveOnboardingWorkspaceAction(input: unknown) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return err("unauthenticated", "Sign in before starting onboarding.");
    }

    const parsed = workspaceOnboardingSchema.parse(input);
    const existing = await getActiveOrganizationForUser(user.id);
    const profile = {
      name: parsed.name,
      companyType: parsed.teamType,
      defaultRegion: "",
      defaultCountry: "",
      timezone: parsed.timezone,
    };
    const organization = existing
      ? await updateOrganizationProfile(existing.organization.id, profile)
      : await createOrganizationForUser(user, profile);

    await setOnboardingStep(organization.id, "environment", {
      workspace_completed_at: new Date().toISOString(),
      team_type: parsed.teamType,
    });
    await logAuditEvent({
      organizationId: organization.id,
      userId: user.id,
      action: existing ? "organization.updated" : "organization.created",
      resourceType: "organization",
      resourceId: organization.id,
      details: { onboarding: true },
    });
    revalidatePath("/onboarding");

    return ok({ organizationId: organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveOnboardingEnvironmentAction(input: unknown) {
  try {
    const active = await requireActiveOrganization();
    const parsed = environmentOnboardingSchema.parse(input);
    await updateOnboardingEnvironment(active.organization.id, parsed);
    await setOnboardingStep(active.organization.id, "remediation", {
      environment_completed_at: new Date().toISOString(),
    });
    revalidatePath("/onboarding");
    return ok({ organizationId: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveOnboardingRemediationPolicyAction(input: unknown) {
  try {
    const active = await requireActiveOrganization();
    const parsed = remediationPolicyOnboardingSchema.parse(input);
    await updateRemediationPolicyPreset(active.organization.id, parsed);
    await setOnboardingStep(active.organization.id, "data", {
      remediation_policy_completed_at: new Date().toISOString(),
      remediation_policy_preset: parsed.preset,
    });
    revalidatePath("/onboarding");
    return ok({ organizationId: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function seedSampleAssetsAction(): Promise<
  ActionResult<{ createdAssets: number; updatedAssets: number; totalRows: number }>
> {
  try {
    const active = await requireActiveOrganization();
    const fixturePath = join(process.cwd(), "fixtures", "sample-assets.csv");
    const csvText = await readFile(fixturePath, "utf8");
    const file = new File([csvText], "sample-assets.csv", {
      type: "text/csv",
    });
    const result = await importAssetsFromCsv({
      file,
      importedBy: active.membership.profileId,
      organizationId: active.organization.id,
    });

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: active.membership.profileId,
      action: "onboarding.sample_assets_imported",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: {
        totalRows: result.totalRows,
        createdAssets: result.createdAssets,
        updatedAssets: result.updatedAssets,
        errorCount: result.errors.length,
      },
    });
    revalidatePath("/assets");
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");

    return ok({
      createdAssets: result.createdAssets,
      updatedAssets: result.updatedAssets,
      totalRows: result.totalRows,
    });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function completeOnboardingAction(input?: unknown) {
  try {
    const active = await requireActiveOrganization();
    const parsed = firstDataChoiceSchema.parse(input ?? {});
    await completeOrganizationOnboarding(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: active.membership.profileId,
      action: "organization.onboarding_completed",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: { completed: true, firstDataChoice: parsed.firstDataChoice },
    });
    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    return ok({ redirectTo: "/dashboard" });
  } catch (error) {
    return toActionResult(error);
  }
}
