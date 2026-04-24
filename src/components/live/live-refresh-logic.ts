export type LiveScope =
  | "dashboard"
  | "assets"
  | "vulnerabilities"
  | "alerts"
  | "remediation"
  | "scan-import"
  | "reports";

export function getLiveScope(pathname: string): LiveScope {
  if (pathname.startsWith("/assets")) {
    return "assets";
  }

  if (pathname.startsWith("/vulnerabilities")) {
    return "vulnerabilities";
  }

  if (pathname.startsWith("/alerts")) {
    return "alerts";
  }

  if (pathname.startsWith("/remediation")) {
    return "remediation";
  }

  if (pathname.startsWith("/scan-import")) {
    return "scan-import";
  }

  if (pathname.startsWith("/reports")) {
    return "reports";
  }

  return "dashboard";
}

export function shouldRefreshForLiveToken(input: {
  previousToken: string | null;
  nextToken: string | null | undefined;
  now: number;
  lastRefreshAt: number;
  refreshCooldownMs: number;
}) {
  if (!input.previousToken || !input.nextToken) {
    return false;
  }

  if (input.previousToken === input.nextToken) {
    return false;
  }

  return input.now - input.lastRefreshAt >= input.refreshCooldownMs;
}
