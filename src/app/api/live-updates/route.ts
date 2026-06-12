import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import type { AppPermission } from "@/lib/permissions";
import { startServerTiming } from "@/lib/observability/timing";
import { getActiveOrganizationForUser } from "@/lib/services/organizations";
import {
  getProtectedAreaLiveToken,
  toLiveScope,
} from "@/lib/services/live-updates";
import {
  checkRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const scopePermissions: Record<
  ReturnType<typeof toLiveScope>,
  AppPermission
> = {
  dashboard: "dashboard.view",
  assets: "assets.read",
  vulnerabilities: "asset_vulnerabilities.read",
  alerts: "alerts.read",
  remediation: "remediation.read",
  "scan-import": "scan_imports.read",
  reports: "reports.read",
};

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: Request) {
  const timing = startServerTiming("route.api.liveUpdates");

  try {
    const { searchParams } = new URL(request.url);
    const scope = toLiveScope(searchParams.get("scope"));
    const identity = await getCurrentIdentity();

    if (identity.status === "anonymous") {
      timing.end({ authenticated: false, statusCode: 401, scope });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (
      identity.status !== "authenticated" ||
      !identity.permissions.includes(scopePermissions[scope])
    ) {
      timing.end({ authenticated: true, statusCode: 403, scope });
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const activeOrganization = identity.user?.id
      ? await getActiveOrganizationForUser(identity.user.id)
      : null;

    if (!activeOrganization) {
      timing.end({ authenticated: true, statusCode: 403, scope });
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const rateLimit = checkRateLimit({
      key: `live-updates:${scope}:${activeOrganization.organization.id}:${identity.user?.id ?? getClientIp(request)}`,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      timing.end({ authenticated: true, statusCode: 429, scope });
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              getRateLimitRetryAfterSeconds(rateLimit.resetAt)
            ),
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const token = await getProtectedAreaLiveToken(
      scope,
      activeOrganization.organization.id
    );
    timing.end({
      authenticated: true,
      statusCode: 200,
      scope,
      organizationId: activeOrganization.organization.id,
    });

    return NextResponse.json(
      { token },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    timing.fail({
      error: error instanceof Error ? error.name : "unknown",
      statusCode: 500,
    });
    throw error;
  }
}
