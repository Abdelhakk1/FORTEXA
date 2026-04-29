import "server-only";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import {
  getActiveOrganizationForUser,
  type ActiveOrganizationContext,
} from "@/lib/services/organizations";
import { getCurrentIdentity, getCurrentUser } from "./identity";

export async function getActiveOrganization() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return getActiveOrganizationForUser(user.id);
}

export async function requireActiveOrganization(): Promise<ActiveOrganizationContext> {
  const identity = await getCurrentIdentity();

  if (identity.status === "anonymous") {
    redirect("/login");
  }

  const userId = identity.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const activeOrganization = await getActiveOrganizationForUser(userId);

  if (!activeOrganization) {
    redirect("/onboarding");
  }

  return activeOrganization;
}

export async function requireCompletedOnboarding() {
  const activeOrganization = await requireActiveOrganization();

  if (!activeOrganization.organization.onboardingCompleted) {
    redirect("/onboarding");
  }

  return activeOrganization;
}

export async function requireSettingsPermission() {
  const identity = await getCurrentIdentity();

  if (identity.status === "anonymous") {
    redirect("/login");
  }

  if (
    identity.status !== "authenticated" ||
    !identity.permissions.includes("settings.manage")
  ) {
    throw new AppError(
      "forbidden",
      "You do not have permission to manage organization settings."
    );
  }

  return identity;
}
