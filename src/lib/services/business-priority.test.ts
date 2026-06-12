import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateApplicationProfile,
  calculateBusinessPriority,
  calculateCidtSensitivity,
  defaultGabCidtTemplates,
  recommendedFixOrderScore,
  resolveGabCidtContext,
  toSensitivityLevel,
} from "./business-priority";

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
