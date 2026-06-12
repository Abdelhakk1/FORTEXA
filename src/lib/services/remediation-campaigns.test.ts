import assert from "node:assert/strict";
import test from "node:test";
import { buildRemediationCampaignSignature } from "./remediation-campaigns";

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

