import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateApplicationProfile,
  calculateBusinessPriority,
  calculateCidtSensitivity,
  calculateRankV2,
  defaultGabCidtTemplates,
  normalizeSeverity,
  recommendedFixOrderScore,
  resolveGabCidtContext,
  toSensitivityLevel,
} from "./business-priority";
import {
  calculateCanonicalRankV2,
  sourceBackedExploitMaturity,
} from "./rank-v2";

test("CIDT sensitivity is the maximum of C, I, D, and T", () => {
  const sensitivity = calculateCidtSensitivity({
    confidentiality: 1,
    integrity: 3,
    availability: 2,
    traceability: 4,
  });

  assert.equal(sensitivity, 4);
  assert.equal(toSensitivityLevel(sensitivity), "S4");
});

test("application profile follows CIDT and internet exposure rules", () => {
  assert.equal(
    calculateApplicationProfile({
      isInternetExposed: true,
      confidentiality: 1,
      integrity: 1,
    }),
    4
  );
  assert.equal(
    calculateApplicationProfile({
      isInternetExposed: false,
      confidentiality: 4,
      integrity: 2,
    }),
    3
  );
  assert.equal(
    calculateApplicationProfile({
      isInternetExposed: false,
      confidentiality: 2,
      integrity: 3,
    }),
    2
  );
  assert.equal(
    calculateApplicationProfile({
      isInternetExposed: false,
      confidentiality: 2,
      integrity: 2,
    }),
    1
  );
});

test("default GAB CIDT templates keep exposure separate from business CIDT", () => {
  assert.deepEqual(
    defaultGabCidtTemplates.map((template) => ({
      key: template.templateKey,
      cidt: [
        template.cidtConfidentiality,
        template.cidtIntegrity,
        template.cidtAvailability,
        template.cidtTraceability,
      ],
    })),
    [
      { key: "indoor_agency", cidt: [3, 3, 3, 3] },
      { key: "outdoor_agency", cidt: [3, 3, 3, 3] },
    ]
  );
});

test("GAB CIDT inheritance reports the correct source", () => {
  const template = resolveGabCidtContext({
    cidtOverrideEnabled: false,
    gabExposureType: "outdoor_public_street",
    templates: defaultGabCidtTemplates,
    applicationCidt: {
      confidentiality: 4,
      integrity: 4,
      availability: 4,
      traceability: 4,
    },
  });

  assert.equal(template.source, "template");
  assert.equal(template.sourceLabel, "Inherited from Default Outdoor GAB CIDT template");
  assert.deepEqual(template.cidt, {
    confidentiality: 3,
    integrity: 3,
    availability: 3,
    traceability: 3,
  });

  const applicationFallback = resolveGabCidtContext({
    cidtOverrideEnabled: false,
    gabExposureType: "unknown",
    templates: defaultGabCidtTemplates,
    applicationCidt: {
      confidentiality: 4,
      integrity: 3,
      availability: 4,
      traceability: 3,
    },
  });

  assert.equal(applicationFallback.source, "application");
  assert.equal(applicationFallback.sourceLabel, "Inherited from ATM Payment Services");

  const systemFallback = resolveGabCidtContext({
    cidtOverrideEnabled: false,
    gabExposureType: "unknown",
    templates: [],
    applicationCidt: null,
  });

  assert.equal(systemFallback.source, "system_default");
  assert.deepEqual(systemFallback.cidt, {
    confidentiality: 2,
    integrity: 2,
    availability: 2,
    traceability: 2,
  });
});

test("outdoor commercial-center GAB ranks above indoor agency GAB for similar severity", () => {
  const shared = {
    severity: "high",
    cvssScore: 8.0,
    exploitMaturity: "poc_available",
    assetCidt: {
      confidentiality: 3,
      integrity: 3,
      availability: 3,
      traceability: 2,
    },
    applicationCidt: {
      confidentiality: 4,
      integrity: 4,
      availability: 4,
      traceability: 4,
    },
    applicationInternetExposed: false,
  };

  const indoor = calculateBusinessPriority({
    ...shared,
    gabExposureType: "indoor_agency",
  });
  const outdoor = calculateBusinessPriority({
    ...shared,
    gabExposureType: "outdoor_commercial_center",
  });

  assert.ok(outdoor.riskScore > indoor.riskScore);
});

test("high ATM Payment Services CIDT increases business priority score", () => {
  const shared = {
    severity: "medium",
    cvssScore: 6.0,
    exploitMaturity: "theoretical",
    assetCidt: {
      confidentiality: 2,
      integrity: 2,
      availability: 2,
      traceability: 2,
    },
    applicationInternetExposed: false,
    gabExposureType: "indoor_agency",
  };

  const lowApplication = calculateBusinessPriority({
    ...shared,
    applicationCidt: {
      confidentiality: 1,
      integrity: 1,
      availability: 1,
      traceability: 1,
    },
  });
  const highApplication = calculateBusinessPriority({
    ...shared,
    applicationCidt: {
      confidentiality: 4,
      integrity: 4,
      availability: 4,
      traceability: 4,
    },
  });

  assert.ok(highApplication.riskScore > lowApplication.riskScore);
  assert.equal(highApplication.factors.applicationLabel, "ATM Payment Services");
});

test("missing CIDT and exposure use safe defaults without crashing", () => {
  const result = calculateBusinessPriority({
    severity: "high",
    cvssScore: null,
    exploitMaturity: null,
    assetCidt: {
      confidentiality: null,
      integrity: null,
      availability: null,
      traceability: null,
    },
    applicationCidt: {
      confidentiality: null,
      integrity: null,
      availability: null,
      traceability: null,
    },
    applicationInternetExposed: false,
    gabExposureType: null,
  });

  assert.equal(result.assetSensitivity, 2);
  assert.equal(result.factors.assetSensitivity, "S2");
  assert.equal(result.factors.gabExposure, "Unknown");
  assert.ok(result.factors.missingContext.length >= 2);
});

test("recommended fix order prefers outdoor GAB exposure after business priority", () => {
  const shared = {
    businessPriority: "p2",
    applicationSensitivity: "S4",
    applicationProfile: "Profile 3",
    severity: "high",
    cvssScore: 8.1,
    slaStatus: "on_track",
    riskScore: 82,
  };

  const indoor = recommendedFixOrderScore({
    ...shared,
    gabExposureType: "indoor_agency",
  });
  const outdoor = recommendedFixOrderScore({
    ...shared,
    gabExposureType: "outdoor_public_street",
  });

  assert.ok(outdoor > indoor);
});

test("recommended fix order keeps business priority ahead of CVSS-only severity", () => {
  const p1Medium = recommendedFixOrderScore({
    businessPriority: "p1",
    gabExposureType: "indoor_agency",
    applicationSensitivity: "S4",
    applicationProfile: "Profile 3",
    severity: "medium",
    cvssScore: 6.2,
    slaStatus: "on_track",
    riskScore: 91,
  });
  const p3Critical = recommendedFixOrderScore({
    businessPriority: "p3",
    gabExposureType: "outdoor_public_street",
    applicationSensitivity: "S2",
    applicationProfile: "Profile 1",
    severity: "critical",
    cvssScore: 9.8,
    slaStatus: "overdue",
    riskScore: 68,
  });

  assert.ok(p1Medium > p3Critical);
});

test("recommended fix order uses confirmed KEV before scanner exploit maturity", () => {
  const shared = {
    businessPriority: "p2",
    gabExposureType: "outdoor_agency",
    applicationSensitivity: "S4",
    applicationProfile: "Profile 3",
    severity: "high",
    cvssScore: 8.1,
    slaStatus: "at_risk",
    riskScore: 82,
  };

  const scannerActiveOnly = recommendedFixOrderScore({
    ...shared,
    exploitMaturity: "active_in_wild",
    knownExploitation: false,
  });
  const confirmedKev = recommendedFixOrderScore({
    ...shared,
    exploitMaturity: "active_in_wild",
    knownExploitation: true,
  });

  assert.ok(confirmedKev > scannerActiveOnly);
});

test("recommended fix order uses EPSS likelihood when source-backed inputs match", () => {
  const shared = {
    businessPriority: "p2",
    gabExposureType: "outdoor_agency",
    applicationSensitivity: "S4",
    applicationProfile: "Profile 3",
    severity: "high",
    cvssScore: 8.1,
    exploitMaturity: "poc_available",
    knownExploitation: false,
    slaStatus: "at_risk",
    riskScore: 82,
  };

  const lowEpss = recommendedFixOrderScore({
    ...shared,
    epssScore: 0.05,
  });
  const highEpss = recommendedFixOrderScore({
    ...shared,
    epssScore: 0.91,
  });

  assert.ok(highEpss > lowEpss);
});

test("source-backed exploit maturity requires KEV before active-in-wild rank credit", () => {
  assert.equal(
    sourceBackedExploitMaturity("active_in_wild", false),
    "poc_available"
  );
  assert.equal(
    sourceBackedExploitMaturity("poc_available", true),
    "active_in_wild"
  );
});

test("severity normalization uses CVSS when present and Nessus/text fallback when missing", () => {
  const cvss = normalizeSeverity({
    cvssBaseScore: 9.8,
    nessusSeverity: 4,
  });
  const criticalFallback = normalizeSeverity({
    cvssBaseScore: null,
    nessusSeverity: 4,
  });
  const highFallback = normalizeSeverity({
    cvssBaseScore: "",
    nessusSeverity: 3,
  });
  const info = normalizeSeverity({
    nessusSeverity: 0,
  });

  assert.equal(cvss.label, "Critical");
  assert.equal(cvss.cvssScore, 9.8);
  assert.equal(cvss.severitySource, "cvss");
  assert.equal(cvss.severityComponent, 39);
  assert.deepEqual(
    {
      label: criticalFallback.label,
      score: criticalFallback.cvssScore,
      source: criticalFallback.severitySource,
      component: criticalFallback.severityComponent,
    },
    { label: "Critical", score: null, source: "nessus", component: 39 }
  );
  assert.deepEqual(
    {
      label: highFallback.label,
      score: highFallback.cvssScore,
      source: highFallback.severitySource,
      component: highFallback.severityComponent,
    },
    { label: "High", score: null, source: "nessus", component: 32 }
  );
  assert.equal(info.severityComponent, 0);
});

test("Rank v2 falls back to scanner severity when CVSS is missing or zero", () => {
  const rank = calculateRankV2({
    severity: "critical",
    cvssScore: 0,
    exploitMaturity: "theoretical",
    assetCidt: {
      confidentiality: 2,
      integrity: 2,
      availability: 2,
      traceability: 2,
    },
    applicationCidt: {
      confidentiality: 4,
      integrity: 4,
      availability: 4,
      traceability: 4,
    },
    applicationInternetExposed: false,
    gabExposureType: "indoor_agency",
  });

  assert.equal(rank.factorScores.severity, 39);
});

test("canonical Rank v2 persists the same score and factors it explains", () => {
  const av = {
    id: "av-1",
    status: "open",
    riskScore: 12,
    businessPriority: "p4",
    slaDue: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    slaStatus: "at_risk",
    firstSeen: new Date("2026-05-01T00:00:00Z"),
  };
  const asset = {
    id: "asset-1",
    assetCode: "GAB-OUT-001",
    cidtOverrideEnabled: false,
    cidtTemplateKey: null,
    cidtConfidentiality: null,
    cidtIntegrity: null,
    cidtAvailability: null,
    cidtTraceability: null,
    gabExposureType: "outdoor_public_street",
  };
  const cve = {
    id: "cve-1",
    cveId: "CVE-2024-3400",
    severity: "critical",
    cvssScore: "10.0",
    exploitMaturity: "theoretical",
  };

  const canonical = calculateCanonicalRankV2({
    av: av as never,
    asset: asset as never,
    cve: cve as never,
    templates: defaultGabCidtTemplates as never,
    hasCisaKevSource: true,
    epssScore: 0.91,
    trustedSourceCount: 3,
    scannerEvidenceCount: 2,
    scannerEvidenceQuality: 95,
  });

  assert.equal(canonical.priority.riskScore, canonical.rank.score);
  assert.equal(canonical.priority.businessPriority, canonical.rank.businessPriority);
  assert.equal(canonical.priority.factors.rankV2?.score, canonical.rank.score);
  assert.deepEqual(canonical.priority.factors.rankV2?.factorScores, {
    severity: canonical.rank.factorScores.severity,
    threat: canonical.rank.factorScores.threat,
    business: canonical.rank.factorScores.business,
    urgency: canonical.rank.factorScores.urgency,
  });
  assert.match(canonical.rank.shortReason, /KEV/);
  assert.match(canonical.rank.shortReason, /EPSS/);
  assert.match(canonical.rank.shortReason, /Outdoor GAB/);
});
