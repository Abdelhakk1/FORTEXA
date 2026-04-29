import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { getActiveOrganizationForUser } from "@/lib/services/organizations";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  const nextPath = getSafeRedirectPath(getValue((await searchParams).next));

  if (user) {
    if (nextPath.startsWith("/invite/")) {
      redirect(nextPath);
    }

    const activeOrganization = await getActiveOrganizationForUser(user.id);
    redirect(
      activeOrganization?.organization.onboardingCompleted
        ? "/dashboard"
        : "/onboarding"
    );
  }

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
