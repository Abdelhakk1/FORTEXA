import "server-only";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { type AppPermission, type AppRoleName } from "@/lib/permissions";
import { getCurrentIdentity } from "./identity";

export async function requireAuth() {
  const identity = await getCurrentIdentity();

  if (identity.status === "anonymous") {
    redirect("/login");
  }

  if (identity.status !== "authenticated") {
    throw new AppError(
      "forbidden",
      "Your account is not currently allowed to access Fortexa."
    );
  }

  return identity;
}

export async function requireAnyRole(allowedRoles: AppRoleName[]) {
  const identity = await requireAuth();

  if (!identity.roleName || !allowedRoles.includes(identity.roleName)) {
    throw new AppError(
      "forbidden",
      "You do not have permission to perform this action."
    );
  }

  return identity;
}

export async function requireRole(requiredRole: AppRoleName) {
  return requireAnyRole([requiredRole]);
}

export async function requirePermission(permission: AppPermission) {
  const identity = await requireAuth();

  if (!identity.permissions.includes(permission)) {
    throw new AppError(
      "forbidden",
      "You do not have permission to perform this action."
    );
  }

  return identity;
}
