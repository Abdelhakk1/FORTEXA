import "server-only";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import {
  hasPermission,
  type AppPermission,
  type AppRoleName,
} from "@/lib/permissions";
import { getCurrentIdentity } from "./identity";

export async function requireAuth() {
  const identity = await getCurrentIdentity();

  if (identity.status === "anonymous") {
    redirect("/login");
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

  if (!hasPermission(identity.roleName, permission)) {
    throw new AppError(
      "forbidden",
      "You do not have permission to perform this action."
    );
  }

  return identity;
}
