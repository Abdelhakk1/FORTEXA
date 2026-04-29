const SAFE_REDIRECT_PREFIXES = [
  "/dashboard",
  "/assets",
  "/vulnerabilities",
  "/alerts",
  "/remediation",
  "/scan-import",
  "/reports",
  "/settings",
  "/onboarding",
  "/invite",
] as const;

function isSafePathname(pathname: string) {
  return SAFE_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://fortexa.local");

    if (
      parsed.origin !== "https://fortexa.local" ||
      !isSafePathname(parsed.pathname)
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
