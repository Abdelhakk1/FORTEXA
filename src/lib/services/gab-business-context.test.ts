import assert from "node:assert/strict";
import test from "node:test";
import { classifyAssetByRules } from "./gab-business-context";

test("classification rules are case-insensitive and first enabled rule wins", () => {
  const match = classifyAssetByRules(
    {
      preferredAssetCode: "GAB-118",
      name: "Mall lobby GAB",
      hostname: "BNP-MALL-OUT-118",
      branch: "Central branch",
      location: "Commercial center",
    },
    [
      {
        name: "Disabled public rule",
        field: "hostname",
        matchValue: "mall",
        gabExposureType: "outdoor_public_street",
        enabled: false,
      },
      {
        name: "Commercial center rule",
        field: "hostname",
        matchValue: "MALL",
        gabExposureType: "outdoor_commercial_center",
        enabled: true,
      },
      {
        name: "Outdoor rule",
        field: "hostname",
        matchValue: "OUT",
        gabExposureType: "outdoor_agency",
        enabled: true,
      },
    ]
  );

  assert.deepEqual(match, {
    gabExposureType: "outdoor_commercial_center",
    ruleName: "Commercial center rule",
  });
});

test("classification rules return null when no import context matches", () => {
  const match = classifyAssetByRules(
    {
      preferredAssetCode: "GAB-221",
      name: "Unclassified GAB",
      hostname: "BNP-GAB-221",
      branch: null,
      location: null,
    },
    [
      {
        name: "Indoor branch",
        field: "branch",
        matchValue: "branch",
        gabExposureType: "indoor_agency",
        enabled: true,
      },
    ]
  );

  assert.equal(match, null);
});
