import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemediationCampaignSignature,
  formatCvePreview,
} from "./remediation-campaigns";

test("MS17-010 CVEs share one remediation campaign signature", () => {
  const cves = [
    "CVE-2017-0144",
    "CVE-2017-0145",
    "CVE-2017-0146",
    "CVE-2017-0147",
    "CVE-2017-0148",
  ];
  const signatures = cves.map((cveId) =>
    buildRemediationCampaignSignature({
      cveId,
      cveTitle: "MS17-010 Security Update for Microsoft Windows SMB Server",
      scannerFindingCode: cveId === "CVE-2017-0144" ? "97833" : null,
      remediationText:
        "Apply the Microsoft MS17-010 update or replace unsupported Windows builds.",
    })
  );

  assert.equal(new Set(signatures.map((signature) => signature.key)).size, 1);
  assert.equal(signatures[0].title, "MS17-010 / EternalBlue remediation campaign");
  assert.equal(signatures[0].basis, "ms17_010");
});

test("non-MS17 findings use plugin plus remediation text when available", () => {
  const left = buildRemediationCampaignSignature({
    cveId: "CVE-2024-0001",
    cveTitle: "TLS certificate chain is not trusted",
    scannerFindingCode: "51192",
    scannerFindingTitle: "SSL Certificate Cannot Be Trusted",
    remediationText: "Install a certificate signed by a trusted authority.",
  });
  const right = buildRemediationCampaignSignature({
    cveId: "CVE-2024-0002",
    cveTitle: "TLS certificate chain is not trusted",
    scannerFindingCode: "51192",
    scannerFindingTitle: "SSL Certificate Cannot Be Trusted",
    remediationText: "Install a certificate signed by a trusted authority.",
  });

  assert.equal(left.key, right.key);
  assert.equal(left.basis, "nessus_plugin");
});

test("Windows KB findings group by exact KB identifier", () => {
  const left = buildRemediationCampaignSignature({
    cveId: "CVE-2025-24052",
    cveTitle: "Windows update issue",
    scannerFindingTitle:
      "KB5066836: Windows 10 Version 1607 / Windows Server 2016 Security Update (October 2025)",
    remediationText: "Apply Security Update 5066836",
  });
  const right = buildRemediationCampaignSignature({
    cveId: "CVE-2025-24990",
    cveTitle: "Different CVE title",
    remediationText: "Apply Security Update 5066836",
  });
  const other = buildRemediationCampaignSignature({
    cveId: "CVE-2025-54100",
    cveTitle: "Windows update issue",
    scannerFindingTitle:
      "KB5073722: Windows 10 Version 1607 / Windows Server 2016 Security Update (January 2026)",
    remediationText: "Apply Security Update 5073722",
  });

  assert.equal(left.key, right.key);
  assert.equal(left.basis, "kb");
  assert.notEqual(left.key, other.key);
});

test("same SSL RC4 plugin and remediation share one campaign signature", () => {
  const left = buildRemediationCampaignSignature({
    cveId: "CVE-2024-0001",
    scannerFindingCode: "65821",
    scannerFindingTitle: "SSL RC4 Cipher Suites Supported",
    remediationText: "Reconfigure the affected service to disable RC4 cipher suites.",
  });
  const right = buildRemediationCampaignSignature({
    cveId: "CVE-2024-0002",
    scannerFindingCode: "65821",
    scannerFindingTitle: "SSL RC4 Cipher Suites Supported",
    remediationText: "Reconfigure the affected service to disable RC4 cipher suites.",
  });

  assert.equal(left.key, right.key);
});

test("large CVE lists are previewed without dropping the full list", () => {
  const cves = Array.from(
    { length: 74 },
    (_, index) => `CVE-2025-${String(index + 1).padStart(4, "0")}`
  );

  assert.equal(
    formatCvePreview(cves),
    "CVE-2025-0001, CVE-2025-0002, CVE-2025-0003, CVE-2025-0004, CVE-2025-0005 +69 other CVEs"
  );
  assert.equal(cves.length, 74);
});
