import type {
  Asset, Vulnerability, RemediationTask, ScanImport,
  Alert, Report, RoleConfig, RegionConfig, AtmModelConfig,
} from "./types";

// ─── ASSETS ────────────────────────────────────────────────────────
export const assets: Asset[] = [
  { id: "ATM-001", name: "ATM Casablanca Central", type: "ATM", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Casablanca Central", region: "Casablanca-Settat", location: "20 Blvd Mohammed V, Casablanca", ipAddress: "10.1.1.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "Critical", exposureLevel: "Internet-Facing", status: "Active", owner: "Youssef Bennani", lastScanDate: "2026-04-10", vulnerabilityCount: 12, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 92 },
  { id: "ATM-002", name: "ATM Rabat Agdal", type: "ATM", model: "Diebold Nixdorf CS 2020", manufacturer: "Diebold Nixdorf", branch: "Rabat Agdal", region: "Rabat-Salé-Kénitra", location: "15 Ave Hassan II, Rabat", ipAddress: "10.1.2.20", osVersion: "Windows 10 IoT LTSC 2019", criticality: "Critical", exposureLevel: "Internet-Facing", status: "Active", owner: "Fatima Zahra El Idrissi", lastScanDate: "2026-04-10", vulnerabilityCount: 8, maxSeverity: "HIGH", contextualPriority: "P1", riskScore: 85 },
  { id: "ATM-003", name: "ATM Marrakech Guéliz", type: "ATM", model: "Hyosung Halo II", manufacturer: "Hyosung", branch: "Marrakech Guéliz", region: "Marrakech-Safi", location: "Rue de la Liberté, Marrakech", ipAddress: "10.2.1.15", osVersion: "Windows 10 IoT LTSC 2021", criticality: "High", exposureLevel: "Internet-Facing", status: "Active", owner: "Ahmed Tazi", lastScanDate: "2026-04-09", vulnerabilityCount: 5, maxSeverity: "HIGH", contextualPriority: "P2", riskScore: 74 },
  { id: "ATM-004", name: "ATM Fès Médina", type: "ATM", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Fès Médina", region: "Fès-Meknès", location: "Place R'cif, Fès", ipAddress: "10.3.1.10", osVersion: "Windows 10 IoT LTSC 2019", criticality: "High", exposureLevel: "Internal", status: "Active", owner: "Karim Amrani", lastScanDate: "2026-04-08", vulnerabilityCount: 15, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 88 },
  { id: "ATM-005", name: "ATM Tanger Port", type: "ATM", model: "Wincor Cineo C4060", manufacturer: "Wincor Nixdorf", branch: "Tanger Port", region: "Tanger-Tétouan-Al Hoceïma", location: "Zone Portuaire, Tanger", ipAddress: "10.4.1.10", osVersion: "Windows 7 Embedded", criticality: "Critical", exposureLevel: "Internet-Facing", status: "Active", owner: "Nadia Chraibi", lastScanDate: "2026-04-10", vulnerabilityCount: 22, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 96 },
  { id: "ATM-006", name: "ATM Agadir Souss", type: "ATM", model: "Diebold Nixdorf CS 2020", manufacturer: "Diebold Nixdorf", branch: "Agadir Souss", region: "Souss-Massa", location: "Ave Mohammed V, Agadir", ipAddress: "10.5.1.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "Medium", exposureLevel: "Internal", status: "Active", owner: "Rachid Bouzidi", lastScanDate: "2026-04-07", vulnerabilityCount: 3, maxSeverity: "MEDIUM", contextualPriority: "P3", riskScore: 45 },
  { id: "ATM-007", name: "ATM Oujda Centre", type: "ATM", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Oujda Centre", region: "Oriental", location: "Blvd Derfoufi, Oujda", ipAddress: "10.6.1.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "High", exposureLevel: "Internal", status: "Active", owner: "Samira Hajji", lastScanDate: "2026-04-10", vulnerabilityCount: 7, maxSeverity: "HIGH", contextualPriority: "P2", riskScore: 68 },
  { id: "GAB-001", name: "GAB Casablanca Maarif", type: "GAB", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Casablanca Maarif", region: "Casablanca-Settat", location: "Rue du Parc, Casablanca", ipAddress: "10.1.3.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "Critical", exposureLevel: "Internet-Facing", status: "Active", owner: "Youssef Bennani", lastScanDate: "2026-04-10", vulnerabilityCount: 9, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 90 },
  { id: "GAB-002", name: "GAB Rabat Hassan", type: "GAB", model: "Hyosung Halo II", manufacturer: "Hyosung", branch: "Rabat Hassan", region: "Rabat-Salé-Kénitra", location: "Tour Hassan, Rabat", ipAddress: "10.1.4.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "High", exposureLevel: "Internal", status: "Active", owner: "Fatima Zahra El Idrissi", lastScanDate: "2026-04-09", vulnerabilityCount: 4, maxSeverity: "MEDIUM", contextualPriority: "P3", riskScore: 52 },
  { id: "ATM-008", name: "ATM Meknès Centre", type: "ATM", model: "Wincor Cineo C4060", manufacturer: "Wincor Nixdorf", branch: "Meknès Centre", region: "Fès-Meknès", location: "Ave des FAR, Meknès", ipAddress: "10.3.2.10", osVersion: "Windows 10 IoT LTSC 2019", criticality: "Medium", exposureLevel: "Internal", status: "Maintenance", owner: "Karim Amrani", lastScanDate: "2026-04-05", vulnerabilityCount: 6, maxSeverity: "HIGH", contextualPriority: "P2", riskScore: 61 },
  { id: "ATM-009", name: "ATM Kenitra Gare", type: "ATM", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Kenitra Gare", region: "Rabat-Salé-Kénitra", location: "Gare Kenitra", ipAddress: "10.1.5.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "High", exposureLevel: "Internet-Facing", status: "Active", owner: "Fatima Zahra El Idrissi", lastScanDate: "2026-04-10", vulnerabilityCount: 11, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 87 },
  { id: "ATM-010", name: "ATM Tétouan Corniche", type: "ATM", model: "Diebold Nixdorf CS 2020", manufacturer: "Diebold Nixdorf", branch: "Tétouan Corniche", region: "Tanger-Tétouan-Al Hoceïma", location: "Corniche de Tétouan", ipAddress: "10.4.2.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "Medium", exposureLevel: "Internal", status: "Active", owner: "Nadia Chraibi", lastScanDate: "2026-04-09", vulnerabilityCount: 2, maxSeverity: "LOW", contextualPriority: "P4", riskScore: 28 },
  { id: "SRV-001", name: "ATM Switch Server 01", type: "Server", model: "Dell PowerEdge R750", manufacturer: "Dell", branch: "Casablanca HQ", region: "Casablanca-Settat", location: "Datacenter Casablanca", ipAddress: "10.0.0.5", osVersion: "Windows Server 2022", criticality: "Critical", exposureLevel: "Internal", status: "Active", owner: "IT Operations", lastScanDate: "2026-04-10", vulnerabilityCount: 18, maxSeverity: "CRITICAL", contextualPriority: "P1", riskScore: 94 },
  { id: "NET-001", name: "ATM Network Router Core", type: "Network Device", model: "Cisco ISR 4451", manufacturer: "Cisco", branch: "Casablanca HQ", region: "Casablanca-Settat", location: "Datacenter Casablanca", ipAddress: "10.0.0.1", osVersion: "IOS XE 17.6", criticality: "Critical", exposureLevel: "Internal", status: "Active", owner: "Network Team", lastScanDate: "2026-04-10", vulnerabilityCount: 5, maxSeverity: "HIGH", contextualPriority: "P2", riskScore: 72 },
  { id: "ATM-011", name: "ATM El Jadida Centre", type: "ATM", model: "Hyosung Halo II", manufacturer: "Hyosung", branch: "El Jadida Centre", region: "Casablanca-Settat", location: "Ave Mohammed V, El Jadida", ipAddress: "10.1.6.10", osVersion: "Windows 10 IoT LTSC 2021", criticality: "Medium", exposureLevel: "Internal", status: "Active", owner: "Youssef Bennani", lastScanDate: "2026-04-08", vulnerabilityCount: 4, maxSeverity: "MEDIUM", contextualPriority: "P3", riskScore: 42 },
  { id: "ATM-012", name: "ATM Nador Aéroport", type: "ATM", model: "NCR SelfServ 80", manufacturer: "NCR", branch: "Nador Aéroport", region: "Oriental", location: "Aéroport Nador", ipAddress: "10.6.2.10", osVersion: "Windows 10 IoT LTSC 2019", criticality: "High", exposureLevel: "Internet-Facing", status: "Active", owner: "Samira Hajji", lastScanDate: "2026-04-10", vulnerabilityCount: 9, maxSeverity: "HIGH", contextualPriority: "P2", riskScore: 76 },
];

// ─── VULNERABILITIES ───────────────────────────────────────────────
export const vulnerabilities: Vulnerability[] = [
  {
    id: "vuln-001", cveId: "CVE-2021-34527", title: "Windows Print Spooler Remote Code Execution Vulnerability (PrintNightmare)", description: "A remote code execution vulnerability exists when the Windows Print Spooler service improperly performs privileged file operations. An attacker who successfully exploited this vulnerability could run arbitrary code with SYSTEM privileges.", severity: "CRITICAL", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", businessPriority: "P1", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 142, patchAvailable: true, aiRemediationAvailable: true, status: "Open", firstSeen: "2026-03-01", lastSeen: "2026-04-10", slaDue: "2026-04-12", slaStatus: "Overdue",
    affectedProducts: ["Windows 10 IoT LTSC 2019", "Windows 10 IoT LTSC 2021", "Windows Server 2019"],
    impactAnalysis: "Allows remote code execution with SYSTEM privileges on affected ATM terminals. Could enable unauthorized cash dispensing, malware installation, or network lateral movement across the ATM fleet.",
    exploitConditions: "Network access to the Print Spooler service (port 445/TCP). No authentication required. Public exploit code available.",
    trustedSources: [
      { name: "NVD Database", url: "https://nvd.nist.gov/vuln/detail/CVE-2021-34527", updatedAt: "2026-03-15", icon: "database" },
      { name: "Microsoft Security Advisory", url: "https://msrc.microsoft.com", updatedAt: "2026-03-20", icon: "shield" },
      { name: "CISA KEV Catalog", url: "https://www.cisa.gov/known-exploited-vulnerabilities", updatedAt: "2026-04-01", icon: "alert-triangle" },
      { name: "Internal SOC Runbook", url: "#", updatedAt: "2026-04-05", icon: "book-open" },
    ],
    primaryRemediation: "Apply the out-of-band security update provided by Microsoft (KB5004945 or later) immediately to all affected NCR and Diebold assets running Windows 10/Server 2019.",
    compensatingControls: [
      { title: "Disable Print Spooler Service", description: "If printing is not required on the ATM, disable the Print Spooler service via GPO.", command: "Stop-Service -Name Spooler -Force\nSet-Service -Name Spooler -StartupType Disabled" },
      { title: "Disable Inbound Remote Printing", description: "Configure Group Policy to disable 'Allow Print Spooler to accept client connections'." },
    ],
    confidenceScore: 95, contextReason: "This CVE is rated P1 because it affects 142 internet-facing ATMs with active exploitation in the wild (CISA KEV). The Print Spooler RCE allows SYSTEM-level access which could lead to unauthorized ATM control."
  },
  {
    id: "vuln-002", cveId: "CVE-2023-23397", title: "Microsoft Outlook Elevation of Privilege Vulnerability", description: "An elevation of privilege vulnerability in Microsoft Outlook allowing NTLM credential theft via crafted email messages.", severity: "CRITICAL", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", businessPriority: "P1", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 89, patchAvailable: true, aiRemediationAvailable: true, status: "Open", firstSeen: "2026-03-15", lastSeen: "2026-04-10", slaDue: "2026-04-14", slaStatus: "At Risk",
    affectedProducts: ["Microsoft Outlook 2019", "Microsoft 365 Apps"],
    impactAnalysis: "Could allow attackers to harvest NTLM hashes from management workstations used to administer ATM fleet.",
    exploitConditions: "Email delivery to Outlook client. No user interaction required beyond email receipt.",
    trustedSources: [
      { name: "NVD Database", url: "https://nvd.nist.gov", updatedAt: "2026-03-20", icon: "database" },
      { name: "Microsoft Security Advisory", url: "https://msrc.microsoft.com", updatedAt: "2026-03-22", icon: "shield" },
    ],
    primaryRemediation: "Apply Microsoft March 2023 Patch Tuesday updates to all Outlook installations on ATM management workstations.",
    compensatingControls: [
      { title: "Block NTLM to External IPs", description: "Configure Windows Firewall to block outbound NTLM (port 445) to external IP addresses." },
    ],
    confidenceScore: 92, contextReason: "Rated P1 due to active exploitation and direct impact on ATM management infrastructure."
  },
  {
    id: "vuln-003", cveId: "CVE-2022-30190", title: "Microsoft Windows MSDT Remote Code Execution (Follina)", description: "A remote code execution vulnerability via the Microsoft Support Diagnostic Tool through specially crafted Office documents.", severity: "HIGH", cvssScore: 7.8, cvssVector: "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H", businessPriority: "P2", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 210, patchAvailable: true, aiRemediationAvailable: true, status: "Open", firstSeen: "2026-02-20", lastSeen: "2026-04-10", slaDue: "2026-04-28", slaStatus: "On Track",
    affectedProducts: ["Windows 10 IoT LTSC 2021", "Windows 10 IoT LTSC 2019"],
    impactAnalysis: "Could allow code execution if ATM maintenance operator opens malicious document.",
    exploitConditions: "User interaction required - opening malicious Office document.",
    trustedSources: [
      { name: "NVD Database", url: "https://nvd.nist.gov", updatedAt: "2026-02-25", icon: "database" },
    ],
    primaryRemediation: "Apply cumulative Windows updates and disable MSDT URL protocol handler.",
    compensatingControls: [
      { title: "Disable MSDT URL Protocol", description: "Remove the ms-msdt registry key.", command: "reg delete HKEY_CLASSES_ROOT\\ms-msdt /f" },
    ],
    confidenceScore: 88, contextReason: "Rated P2 because it requires user interaction, lowering exploitability on unattended ATMs."
  },
  {
    id: "vuln-004", cveId: "CVE-2023-44487", title: "HTTP/2 Rapid Reset Attack (DDoS)", description: "The HTTP/2 protocol allows a denial of service via rapid stream resets, known as the Rapid Reset attack.", severity: "HIGH", cvssScore: 7.5, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", businessPriority: "P2", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 34, patchAvailable: true, aiRemediationAvailable: false, status: "Open", firstSeen: "2026-01-15", lastSeen: "2026-04-10", slaDue: "2026-04-20", slaStatus: "On Track",
    affectedProducts: ["Nginx 1.22", "Apache 2.4"],
    impactAnalysis: "DDoS against ATM web management interfaces could disrupt fleet monitoring.",
    exploitConditions: "Network access to HTTP/2 enabled services.",
    trustedSources: [{ name: "NVD Database", url: "https://nvd.nist.gov", updatedAt: "2026-01-20", icon: "database" }],
    primaryRemediation: "Update web servers to patched versions. Implement rate limiting on HTTP/2 streams.",
    compensatingControls: [{ title: "Disable HTTP/2", description: "Temporarily downgrade to HTTP/1.1 on ATM management portals." }],
    confidenceScore: 82, contextReason: "P2 - availability impact only, no data compromise."
  },
  {
    id: "vuln-005", cveId: "CVE-2024-21351", title: "Windows SmartScreen Security Feature Bypass", description: "A vulnerability allowing bypass of Windows SmartScreen protection.", severity: "MEDIUM", cvssScore: 6.5, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N", businessPriority: "P3", exploitMaturity: "POC Available", affectedAssetsCount: 156, patchAvailable: true, aiRemediationAvailable: true, status: "Open", firstSeen: "2026-02-10", lastSeen: "2026-04-10", slaDue: "2026-05-10", slaStatus: "On Track",
    affectedProducts: ["Windows 10 IoT LTSC 2021"],
    impactAnalysis: "Could bypass download protection on ATM management terminals.",
    exploitConditions: "User must download and execute a file.",
    trustedSources: [{ name: "NVD Database", url: "https://nvd.nist.gov", updatedAt: "2026-02-15", icon: "database" }],
    primaryRemediation: "Apply February 2024 cumulative updates.",
    compensatingControls: [{ title: "Application Whitelisting", description: "Enforce AppLocker policies to prevent unauthorized application execution." }],
    confidenceScore: 78, contextReason: "P3 - requires user interaction on locked-down ATM terminals."
  },
  {
    id: "vuln-006", cveId: "CVE-2023-36884", title: "Office and Windows HTML RCE Vulnerability", description: "A remote code execution vulnerability affecting Microsoft Office and Windows via specially crafted HTML content.", severity: "HIGH", cvssScore: 8.3, cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:H", businessPriority: "P2", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 67, patchAvailable: true, aiRemediationAvailable: true, status: "Mitigated", firstSeen: "2025-12-01", lastSeen: "2026-04-05", slaDue: "2026-04-15", slaStatus: "On Track",
    affectedProducts: ["Microsoft Office 2019", "Windows 10 IoT"],
    impactAnalysis: "Could compromise ATM management workstations through phishing.",
    exploitConditions: "User must open malicious document or link.",
    trustedSources: [{ name: "Microsoft Security Advisory", url: "https://msrc.microsoft.com", updatedAt: "2025-12-10", icon: "shield" }],
    primaryRemediation: "Apply Office and Windows security updates. Deploy MOCE registry mitigations.",
    compensatingControls: [{ title: "Block Office from creating child processes", description: "Use ASR rules to block Office from launching child processes." }],
    confidenceScore: 85, contextReason: "P2 - actively exploited but mitigated on most workstations."
  },
  {
    id: "vuln-007", cveId: "CVE-2024-3400", title: "Palo Alto PAN-OS GlobalProtect Command Injection", description: "Critical command injection vulnerability in Palo Alto Networks PAN-OS GlobalProtect gateway.", severity: "CRITICAL", cvssScore: 10.0, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", businessPriority: "P1", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 4, patchAvailable: true, aiRemediationAvailable: true, status: "Open", firstSeen: "2026-04-01", lastSeen: "2026-04-10", slaDue: "2026-04-13", slaStatus: "Overdue",
    affectedProducts: ["PAN-OS 10.2", "PAN-OS 11.0", "PAN-OS 11.1"],
    impactAnalysis: "Complete compromise of network perimeter firewalls protecting ATM infrastructure.",
    exploitConditions: "Network access to GlobalProtect portal. No authentication required.",
    trustedSources: [{ name: "Palo Alto Security Advisory", url: "https://security.paloaltonetworks.com", updatedAt: "2026-04-05", icon: "shield" }, { name: "CISA KEV Catalog", url: "https://www.cisa.gov/known-exploited-vulnerabilities", updatedAt: "2026-04-08", icon: "alert-triangle" }],
    primaryRemediation: "Upgrade PAN-OS to fixed version immediately. Apply Threat Prevention signatures.",
    compensatingControls: [{ title: "Disable GlobalProtect Telemetry", description: "Disable device telemetry to mitigate the vulnerability." }],
    confidenceScore: 98, contextReason: "P1 - CVSS 10.0, network perimeter device with no auth required. Directly protects ATM network segment."
  },
  {
    id: "vuln-008", cveId: "CVE-2023-4966", title: "Citrix NetScaler ADC Information Disclosure (Citrix Bleed)", description: "Sensitive information disclosure vulnerability in Citrix NetScaler ADC and Gateway.", severity: "HIGH", cvssScore: 7.5, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", businessPriority: "P2", exploitMaturity: "Active in Wild (KEV)", affectedAssetsCount: 8, patchAvailable: true, aiRemediationAvailable: false, status: "Open", firstSeen: "2026-02-01", lastSeen: "2026-04-10", slaDue: "2026-04-25", slaStatus: "On Track",
    affectedProducts: ["NetScaler ADC 13.1", "NetScaler Gateway 13.1"],
    impactAnalysis: "Session token leakage could allow unauthorized access to ATM management VPN.",
    exploitConditions: "Network access to NetScaler management interface.",
    trustedSources: [{ name: "Citrix Advisory", url: "https://support.citrix.com", updatedAt: "2026-02-10", icon: "shield" }],
    primaryRemediation: "Upgrade NetScaler to patched version. Rotate all session tokens post-patch.",
    compensatingControls: [{ title: "Kill existing sessions", description: "Force disconnect all active sessions and require re-authentication." }],
    confidenceScore: 80, contextReason: "P2 - information disclosure, requires additional steps for full compromise."
  },
];

// ─── REMEDIATION TASKS ─────────────────────────────────────────────
export const remediationTasks: RemediationTask[] = [
  { id: "REM-001", title: "Apply KB5004945 PrintNightmare Patch", description: "Deploy critical PrintNightmare patch to all affected NCR and Diebold ATMs running Windows 10/Server 2019.", relatedCve: "CVE-2021-34527", relatedAsset: "142 ATMs", assignedOwner: "Youssef Bennani", assignedAvatar: "YB", dueDate: "2026-04-12", slaStatus: "Overdue", status: "In Progress", priority: "CRITICAL", businessPriority: "P1", affectedAssetsCount: 142, progress: 35, notes: "SCCM deployment package created. Rolling out in batches of 20 ATMs.", createdAt: "2026-03-05", updatedAt: "2026-04-10", changeRequest: "CR-7821" },
  { id: "REM-002", title: "Update OpenSSL to 1.1.1t on Branch Kiosks", description: "Multiple CVEs related to OpenSSL vulnerabilities on older kiosk machines.", relatedCve: "CVE-2023-0286", relatedAsset: "Branch Kiosks", assignedOwner: "Ahmed Tazi", assignedAvatar: "AT", dueDate: "2026-04-15", slaStatus: "On Track", status: "Open", priority: "MEDIUM", businessPriority: "P3", affectedAssetsCount: 28, progress: 0, notes: "", createdAt: "2026-03-20", updatedAt: "2026-04-08" },
  { id: "REM-003", title: "Disable SNMPv2 on Core Routers", description: "Replace SNMPv2 with SNMPv3 on all core ATM network routers.", relatedCve: "CVE-2022-20968", relatedAsset: "Core Routers", assignedOwner: "Network Team", assignedAvatar: "NT", dueDate: "2026-04-14", slaStatus: "At Risk", status: "Assigned", priority: "HIGH", businessPriority: "P2", affectedAssetsCount: 12, progress: 0, notes: "Pending change approval from CAB.", createdAt: "2026-03-15", updatedAt: "2026-04-10", changeRequest: "CR-8842" },
  { id: "REM-004", title: "Patch PAN-OS GlobalProtect Firewalls", description: "Emergency upgrade PAN-OS to address CVE-2024-3400 command injection.", relatedCve: "CVE-2024-3400", relatedAsset: "4 Firewalls", assignedOwner: "Nadia Chraibi", assignedAvatar: "NC", dueDate: "2026-04-13", slaStatus: "Overdue", status: "In Progress", priority: "CRITICAL", businessPriority: "P1", affectedAssetsCount: 4, progress: 50, notes: "2 of 4 firewalls patched. Maintenance window for remaining 2 scheduled tonight.", createdAt: "2026-04-02", updatedAt: "2026-04-10" },
  { id: "REM-005", title: "Deploy Outlook Security Updates", description: "Apply March Patch Tuesday updates to all ATM management workstations.", relatedCve: "CVE-2023-23397", relatedAsset: "89 Workstations", assignedOwner: "Fatima Zahra El Idrissi", assignedAvatar: "FE", dueDate: "2026-04-14", slaStatus: "At Risk", status: "In Progress", priority: "CRITICAL", businessPriority: "P1", affectedAssetsCount: 89, progress: 72, notes: "64 of 89 workstations updated. Remaining require manual intervention.", createdAt: "2026-03-18", updatedAt: "2026-04-10" },
  { id: "REM-006", title: "Chrome Zero-Day Emergency Patch", description: "Apply Chrome emergency update for CVE-2024-0519 on all endpoints.", relatedCve: "CVE-2024-0519", relatedAsset: "All Endpoints", assignedOwner: "Rachid Bouzidi", assignedAvatar: "RB", dueDate: "2026-04-10", slaStatus: "Overdue", status: "Closed", priority: "HIGH", businessPriority: "P2", affectedAssetsCount: 340, progress: 100, notes: "Completed. All Chrome instances updated via GPO.", createdAt: "2026-03-01", updatedAt: "2026-04-10" },
  { id: "REM-007", title: "Upgrade NetScaler ADC Firmware", description: "Patch Citrix Bleed vulnerability on ADC appliances.", relatedCve: "CVE-2023-4966", relatedAsset: "8 NetScalers", assignedOwner: "Karim Amrani", assignedAvatar: "KA", dueDate: "2026-04-25", slaStatus: "On Track", status: "Assigned", priority: "HIGH", businessPriority: "P2", affectedAssetsCount: 8, progress: 0, notes: "Firmware downloaded. Scheduling maintenance window.", createdAt: "2026-04-01", updatedAt: "2026-04-08" },
  { id: "REM-008", title: "Harden Windows 7 Embedded ATMs", description: "Apply compensating controls on legacy W7 ATMs pending hardware refresh.", relatedCve: "Multiple", relatedAsset: "ATM-005", assignedOwner: "Nadia Chraibi", assignedAvatar: "NC", dueDate: "2026-04-30", slaStatus: "On Track", status: "Open", priority: "CRITICAL", businessPriority: "P1", affectedAssetsCount: 3, progress: 0, notes: "Hardware refresh budget approved for Q3.", createdAt: "2026-04-05", updatedAt: "2026-04-10" },
];

// ─── SCAN IMPORTS ──────────────────────────────────────────────────
export const scanImports: ScanImport[] = [
  { id: "IMP-001", name: "Full ATM Fleet Scan - April 2026", scannerSource: "Nessus", importDate: "2026-04-10", importedBy: "Youssef Bennani", fileName: "nessus_atm_fleet_20260410.nessus", fileSize: "48.2 MB", assetsFound: 142, findingsFound: 1847, cvesLinked: 326, newAssets: 0, newVulnerabilities: 23, closedVulnerabilities: 12, errors: 2, warnings: 5, status: "Completed", processingTime: "4m 32s" },
  { id: "IMP-002", name: "Network Infrastructure Scan", scannerSource: "OpenVAS", importDate: "2026-04-08", importedBy: "Karim Amrani", fileName: "openvas_network_20260408.xml", fileSize: "12.7 MB", assetsFound: 34, findingsFound: 287, cvesLinked: 89, newAssets: 2, newVulnerabilities: 8, closedVulnerabilities: 3, errors: 0, warnings: 1, status: "Completed", processingTime: "2m 15s" },
  { id: "IMP-003", name: "Casablanca Branch Perimeter Scan", scannerSource: "Nmap", importDate: "2026-04-05", importedBy: "Nadia Chraibi", fileName: "nmap_casa_perimeter_20260405.xml", fileSize: "3.1 MB", assetsFound: 28, findingsFound: 156, cvesLinked: 42, newAssets: 1, newVulnerabilities: 5, closedVulnerabilities: 0, errors: 0, warnings: 0, status: "Completed", processingTime: "1m 08s" },
  { id: "IMP-004", name: "Rabat Region ATM Scan", scannerSource: "Nessus", importDate: "2026-04-03", importedBy: "Fatima Zahra El Idrissi", fileName: "nessus_rabat_20260403.nessus", fileSize: "22.5 MB", assetsFound: 38, findingsFound: 623, cvesLinked: 145, newAssets: 0, newVulnerabilities: 11, closedVulnerabilities: 7, errors: 1, warnings: 3, status: "Completed", processingTime: "3m 05s" },
  { id: "IMP-005", name: "Web Application Assessment", scannerSource: "Qualys", importDate: "2026-03-28", importedBy: "Ahmed Tazi", fileName: "qualys_webapp_20260328.csv", fileSize: "8.9 MB", assetsFound: 15, findingsFound: 98, cvesLinked: 33, newAssets: 0, newVulnerabilities: 4, closedVulnerabilities: 2, errors: 0, warnings: 0, status: "Completed", processingTime: "1m 45s" },
  { id: "IMP-006", name: "Emergency PAN-OS Scan", scannerSource: "Nessus", importDate: "2026-04-02", importedBy: "Nadia Chraibi", fileName: "nessus_panos_emergency_20260402.nessus", fileSize: "1.2 MB", assetsFound: 4, findingsFound: 12, cvesLinked: 6, newAssets: 0, newVulnerabilities: 2, closedVulnerabilities: 0, errors: 0, warnings: 0, status: "Completed", processingTime: "0m 32s" },
  { id: "IMP-007", name: "Fès-Meknès Branch Scan", scannerSource: "OpenVAS", importDate: "2026-03-25", importedBy: "Karim Amrani", fileName: "openvas_fes_meknes_20260325.xml", fileSize: "15.3 MB", assetsFound: 24, findingsFound: 412, cvesLinked: 98, newAssets: 3, newVulnerabilities: 15, closedVulnerabilities: 4, errors: 3, warnings: 2, status: "Partial", processingTime: "2m 48s" },
];

// ─── ALERTS ────────────────────────────────────────────────────────
export const alerts: Alert[] = [
  { id: "ALR-001", title: "PrintNightmare SLA Breach - 142 ATMs Affected", description: "Remediation for CVE-2021-34527 has exceeded the SLA deadline. 142 ATMs remain vulnerable.", severity: "CRITICAL", type: "SLA Breach", relatedAsset: "ATM Fleet", relatedCve: "CVE-2021-34527", createdAt: "2026-04-12", owner: "Youssef Bennani", status: "New" },
  { id: "ALR-002", title: "PAN-OS Critical Vulnerability - Active Exploitation", description: "CVE-2024-3400 is being actively exploited. 2 firewalls remain unpatched.", severity: "CRITICAL", type: "Critical Risk", relatedAsset: "Network Firewalls", relatedCve: "CVE-2024-3400", createdAt: "2026-04-10", owner: "Nadia Chraibi", status: "Acknowledged" },
  { id: "ALR-003", title: "ATM Tanger Port - Windows 7 EOL Exposure", description: "ATM-005 running end-of-life Windows 7 with 22 vulnerabilities. Internet-facing.", severity: "CRITICAL", type: "Exposed ATM", relatedAsset: "ATM-005", relatedCve: "Multiple", createdAt: "2026-04-10", owner: "Nadia Chraibi", status: "In Progress" },
  { id: "ALR-004", title: "New Critical CVE Detected - Outlook EoP", description: "CVE-2023-23397 discovered affecting 89 management workstations.", severity: "HIGH", type: "New Critical CVE", relatedAsset: "Management Workstations", relatedCve: "CVE-2023-23397", createdAt: "2026-04-09", owner: "Fatima Zahra El Idrissi", status: "Acknowledged" },
  { id: "ALR-005", title: "Casablanca Central ATM - Risk Score Above Threshold", description: "ATM-001 risk score (92) exceeds critical threshold (85).", severity: "HIGH", type: "Critical Risk", relatedAsset: "ATM-001", relatedCve: "Multiple", createdAt: "2026-04-08", owner: "Youssef Bennani", status: "Acknowledged" },
  { id: "ALR-006", title: "3 Overdue Remediation Tasks", description: "REM-001, REM-004, and REM-006 have exceeded their due dates.", severity: "HIGH", type: "Overdue Remediation", relatedAsset: "Multiple", relatedCve: "Multiple", createdAt: "2026-04-10", owner: "Security Manager", status: "New" },
  { id: "ALR-007", title: "Fès-Meknès Import Errors", description: "Scan import IMP-007 completed with 3 errors. Manual review required.", severity: "MEDIUM", type: "Policy Violation", relatedAsset: "Fès-Meknès Branch", relatedCve: "N/A", createdAt: "2026-03-25", owner: "Karim Amrani", status: "Resolved" },
  { id: "ALR-008", title: "New ATMs Discovered in Network Scan", description: "2 previously unknown assets found during OpenVAS scan IMP-002.", severity: "MEDIUM", type: "Policy Violation", relatedAsset: "Network", relatedCve: "N/A", createdAt: "2026-04-08", owner: "IT Operations", status: "Acknowledged" },
  { id: "ALR-009", title: "ATM Kenitra Gare - 11 Vulnerabilities Detected", description: "ATM-009 has 11 vulnerabilities including CRITICAL findings.", severity: "HIGH", type: "Exposed ATM", relatedAsset: "ATM-009", relatedCve: "Multiple", createdAt: "2026-04-10", owner: "Fatima Zahra El Idrissi", status: "New" },
  { id: "ALR-010", title: "Compliance Gap - PCI DSS 3.2 Baseline", description: "12 ATMs fail PCI DSS requirement 6.2 (timely patching).", severity: "HIGH", type: "Policy Violation", relatedAsset: "Multiple ATMs", relatedCve: "Multiple", createdAt: "2026-04-07", owner: "Compliance Team", status: "New" },
  { id: "ALR-011", title: "ATM Switch Server Critical Exposure", description: "SRV-001 has 18 vulnerabilities and CRITICAL risk score of 94.", severity: "CRITICAL", type: "Critical Risk", relatedAsset: "SRV-001", relatedCve: "Multiple", createdAt: "2026-04-10", owner: "IT Operations", status: "New" },
  { id: "ALR-012", title: "Citrix Bleed Vulnerability on ATM VPN", description: "CVE-2023-4966 affects 8 NetScaler appliances providing ATM VPN access.", severity: "HIGH", type: "New Critical CVE", relatedAsset: "NetScaler ADCs", relatedCve: "CVE-2023-4966", createdAt: "2026-04-05", owner: "Karim Amrani", status: "Acknowledged" },
];

// ─── REPORTS ───────────────────────────────────────────────────────
export const reports: Report[] = [
  { id: "RPT-001", name: "PCI-DSS ATM Compliance", description: "Focus: Windows 7/10 Fleet", type: "Compliance", schedule: "Weekly (Mon)", lastRun: "2026-04-07", status: "Active" },
  { id: "RPT-002", name: "Critical Overdue SLAs", description: "Focus: High/Critical > 30 Days", type: "Risk Posture", schedule: "Daily", lastRun: "2026-04-10", status: "Active" },
  { id: "RPT-003", name: "Executive Board Summary", description: "High-level Metrics & Trends", type: "Executive", schedule: "Monthly (1st)", lastRun: "2026-04-01", status: "Active" },
  { id: "RPT-004", name: "Branch Vulnerability Report", description: "Per-region ATM risk breakdown", type: "Custom", schedule: "Bi-weekly", lastRun: "2026-04-08", status: "Active" },
  { id: "RPT-005", name: "Remediation Velocity Report", description: "MTTR, SLA compliance trends", type: "Remediation", schedule: "Weekly (Fri)", lastRun: "2026-04-05", status: "Active" },
];

// ─── SETTINGS ──────────────────────────────────────────────────────
export const roles: RoleConfig[] = [
  { name: "Super Admin", permissions: "Full Access", mfaRequired: "Enforced" },
  { name: "SOC Analyst", permissions: "Read, Manage Alerts, Remediate", mfaRequired: "Enforced" },
  { name: "Auditor", permissions: "Read Only (Reports, Logs)", mfaRequired: "Optional" },
];

export const regions: RegionConfig[] = [
  { name: "Casablanca-Settat", code: "CS" },
  { name: "Rabat-Salé-Kénitra", code: "RSK" },
  { name: "Fès-Meknès", code: "FM" },
  { name: "Marrakech-Safi", code: "MS" },
  { name: "Tanger-Tétouan-Al Hoceïma", code: "TTA" },
  { name: "Oriental", code: "OR" },
  { name: "Souss-Massa", code: "SM" },
];

export const atmModels: AtmModelConfig[] = [
  { name: "NCR SelfServ 80 Series" },
  { name: "Diebold Nixdorf CS 2020" },
  { name: "Hyosung Halo II" },
  { name: "Wincor Cineo C4060" },
];

// ─── CHART DATA ────────────────────────────────────────────────────
export const severityDistribution = [
  { name: "Critical", value: 24, color: "#EF4444" },
  { name: "High", value: 67, color: "#F59E0B" },
  { name: "Medium", value: 156, color: "#3B82F6" },
  { name: "Low", value: 79, color: "#10B981" },
];

export const businessPriorityDistribution = [
  { name: "P1 - Critical", value: 18 },
  { name: "P2 - High", value: 42 },
  { name: "P3 - Medium", value: 89 },
  { name: "P4 - Low", value: 112 },
  { name: "P5 - Minimal", value: 65 },
];

export const exposureTrend = [
  { month: "Nov", critical: 28, high: 72, medium: 145, low: 82 },
  { month: "Dec", critical: 32, high: 68, medium: 152, low: 78 },
  { month: "Jan", critical: 26, high: 75, medium: 148, low: 85 },
  { month: "Feb", critical: 22, high: 70, medium: 140, low: 80 },
  { month: "Mar", critical: 20, high: 65, medium: 135, low: 76 },
  { month: "Apr", critical: 24, high: 67, medium: 156, low: 79 },
];

export const remediationTrend = [
  { month: "Nov", opened: 45, closed: 38, overdue: 8 },
  { month: "Dec", opened: 52, closed: 44, overdue: 12 },
  { month: "Jan", opened: 38, closed: 42, overdue: 10 },
  { month: "Feb", opened: 41, closed: 48, overdue: 7 },
  { month: "Mar", opened: 55, closed: 50, overdue: 9 },
  { month: "Apr", opened: 48, closed: 35, overdue: 14 },
];

export const topVulnerableModels = [
  { name: "NCR SelfServ 80", value: 342 },
  { name: "Diebold CS 2020", value: 287 },
  { name: "NCR Persona", value: 198 },
  { name: "Wincor Cineo", value: 156 },
  { name: "Hyosung Halo II", value: 112 },
];

export const heatmapData = [
  { region: "Casablanca-Settat", critical: 12, high: 28, medium: 45, low: 22 },
  { region: "Rabat-Salé-Kénitra", critical: 8, high: 19, medium: 32, low: 18 },
  { region: "Fès-Meknès", critical: 6, high: 15, medium: 28, low: 14 },
  { region: "Marrakech-Safi", critical: 3, high: 8, medium: 18, low: 12 },
  { region: "Tanger-Tétouan-Al Hoceïma", critical: 5, high: 12, medium: 22, low: 10 },
  { region: "Oriental", critical: 4, high: 9, medium: 15, low: 8 },
  { region: "Souss-Massa", critical: 1, high: 4, medium: 8, low: 6 },
];
