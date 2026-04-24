import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { startServerTiming } from "@/lib/observability/timing";

export async function proxy(request: NextRequest) {
  const timing = startServerTiming("proxy.passThrough", {
    pathname: request.nextUrl.pathname,
  });
  timing.end();
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
