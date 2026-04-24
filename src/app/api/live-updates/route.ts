import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import type { AppPermission } from "@/lib/permissions";
import { startServerTiming } from "@/lib/observability/timing";
import {
  getProtectedAreaLiveToken,
  toLiveScope,
} from "@/lib/services/live-updates";

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

    const token = await getProtectedAreaLiveToken(scope);
    timing.end({
      authenticated: true,
      statusCode: 200,
      scope,
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
