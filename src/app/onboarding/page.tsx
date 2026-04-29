import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveOrganizationForUser } from "@/lib/services/organizations";
import { OnboardingPageClient } from "./onboarding-page-client";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const activeOrganization = await getActiveOrganizationForUser(user.id);

  if (activeOrganization?.organization.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <OnboardingPageClient
      organization={activeOrganization?.organization ?? null}
      settings={activeOrganization?.settings ?? null}
    />
  );
}
