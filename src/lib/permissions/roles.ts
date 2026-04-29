export const appRoles = [
  "administrator",
  "security_manager",
  "security_analyst",
  "remediation_owner",
] as const;

export type AppRoleName = (typeof appRoles)[number];

export const appPermissions = [
  "dashboard.view",
  "identity.read",
  "assets.read",
  "assets.write",
  "asset_vulnerabilities.read",
  "asset_vulnerabilities.write",
  "alerts.read",
  "alerts.acknowledge",
  "alerts.resolve",
  "remediation.read",
  "remediation.write",
  "remediation.update_status",
  "scan_imports.read",
  "scan_imports.write",
  "scan_findings.read",
  "cves.read",
  "cves.enrich",
  "reports.read",
  "reports.write",
  "settings.manage",
  "audit.read",
  "roles.manage",
  "scoring_policies.manage",
] as const;

export type AppPermission = (typeof appPermissions)[number];

export const rolePermissions: Record<AppRoleName, readonly AppPermission[]> = {
  administrator: appPermissions,
  security_manager: [
    "dashboard.view",
    "identity.read",
    "assets.read",
    "asset_vulnerabilities.read",
    "alerts.read",
    "alerts.acknowledge",
    "alerts.resolve",
    "remediation.read",
    "scan_imports.read",
    "scan_findings.read",
    "cves.read",
    "reports.read",
    "reports.write",
    "settings.manage",
    "audit.read",
  ],
  security_analyst: [
    "dashboard.view",
    "identity.read",
    "assets.read",
    "assets.write",
    "asset_vulnerabilities.read",
    "asset_vulnerabilities.write",
    "alerts.read",
    "alerts.acknowledge",
    "alerts.resolve",
    "remediation.read",
    "remediation.write",
    "scan_imports.read",
    "scan_imports.write",
    "scan_findings.read",
    "cves.read",
    "cves.enrich",
    "reports.read",
    "reports.write",
  ],
  remediation_owner: [
    "dashboard.view",
    "identity.read",
    "asset_vulnerabilities.read",
    "alerts.read",
    "alerts.acknowledge",
    "remediation.read",
    "remediation.update_status",
    "cves.read",
    "reports.read",
  ],
};

export function normalizeRoleName(roleName: string | null | undefined) {
  if (!roleName) {
    return null;
  }

  return appRoles.find((role) => role === roleName) ?? null;
}

export function getPermissionsForRole(roleName: AppRoleName | null) {
  return roleName ? rolePermissions[roleName] : [];
}

export function hasPermission(
  roleName: AppRoleName | null,
  permission: AppPermission
) {
  return roleName ? rolePermissions[roleName].includes(permission) : false;
}
