import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AppError } from "@/lib/errors";
import { parseNessusXml } from "./ingestion";

test("Nessus parser accepts the sample export and normalizes CVE IDs", async () => {
  const xml = await readFile("./fixtures/sample-nessus-import.nessus", "utf8");
  const parsed = parseNessusXml(xml);
  const cveIds = parsed.assets.flatMap((asset) =>
    asset.findings.flatMap((finding) => finding.cveIds)
  );

  assert.ok(parsed.assets.length > 0);
  assert.ok(cveIds.length > 0);
  assert.ok(cveIds.every((cveId) => /^CVE-\d{4}-\d{4,}$/.test(cveId)));
  assert.ok(parsed.assets.every((entry) => entry.asset.type === "atm" || entry.asset.type === "gab"));
  assert.ok(parsed.assets.every((entry) => entry.asset.gabExposureType === "unknown"));
  assert.ok(parsed.assets.every((entry) => entry.asset.cidtOverrideEnabled === false));
  assert.ok(parsed.assets.every((entry) => entry.asset.businessApplicationId === null));
  assert.ok(
    parsed.assets.every((entry) =>
      entry.findings.every(
        (finding) => finding.exploitMaturity !== "active_in_wild"
      )
    )
  );
  assert.ok(
    parsed.assets.every(
      (entry) =>
        entry.asset.cidtConfidentiality === null &&
        entry.asset.cidtIntegrity === null &&
        entry.asset.cidtAvailability === null &&
        entry.asset.cidtTraceability === null
    )
  );
});

test("Nessus parser classifies GAB exposure from Fortexa tags and hostnames", () => {
  const xml = `
    <NessusClientData_v2>
      <Report name="Fortexa GAB demo">
        <ReportHost name="GAB-OUT-CC-001">
          <HostProperties>
            <tag name="host-fqdn">GAB-OUT-CC-001</tag>
            <tag name="host-ip">10.20.0.1</tag>
            <tag name="fortexa-exposure">Outdoor GAB</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-OUT-STREET-002">
          <HostProperties>
            <tag name="host-fqdn">GAB-OUT-STREET-002</tag>
            <tag name="host-ip">10.20.0.2</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-OUT-MALL-003">
          <HostProperties>
            <tag name="hostname">GAB-OUT-MALL-003</tag>
            <tag name="host-ip">10.20.0.3</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-IN-AGENCY-004">
          <HostProperties>
            <tag name="host-fqdn">GAB-IN-AGENCY-004</tag>
            <tag name="host-ip">10.20.0.4</tag>
            <tag name="fortexa-gab-exposure">indoor</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-IN-LOBBY-005">
          <HostProperties>
            <tag name="netbios-name">GAB-IN-LOBBY-005</tag>
            <tag name="host-ip">10.20.0.5</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-IN-ATMROOM-006">
          <HostProperties>
            <tag name="host-fqdn">GAB-IN-ATMROOM-006</tag>
            <tag name="host-ip">10.20.0.6</tag>
          </HostProperties>
        </ReportHost>
        <ReportHost name="GAB-IND-BNP-007">
          <HostProperties>
            <tag name="host-fqdn">GAB-IND-BNP-007</tag>
            <tag name="host-ip">10.20.0.7</tag>
          </HostProperties>
        </ReportHost>
      </Report>
    </NessusClientData_v2>
  `;

  const parsed = parseNessusXml(xml);
  const assetsByName = new Map(
    parsed.assets.map((entry) => [entry.asset.name, entry.asset])
  );

  assert.equal(assetsByName.get("GAB-OUT-CC-001")?.gabExposureType, "outdoor_agency");
  assert.equal(assetsByName.get("GAB-OUT-STREET-002")?.gabExposureType, "outdoor_agency");
  assert.equal(assetsByName.get("GAB-OUT-MALL-003")?.gabExposureType, "outdoor_agency");
  assert.equal(assetsByName.get("GAB-IN-AGENCY-004")?.gabExposureType, "indoor_agency");
  assert.equal(assetsByName.get("GAB-IN-LOBBY-005")?.gabExposureType, "indoor_agency");
  assert.equal(assetsByName.get("GAB-IN-ATMROOM-006")?.gabExposureType, "indoor_agency");
  assert.equal(assetsByName.get("GAB-IND-BNP-007")?.gabExposureType, "indoor_agency");

  const taggedOutdoorMetadata = assetsByName.get("GAB-OUT-CC-001")?.metadata
    .exposureClassification as Record<string, unknown> | undefined;
  const inferredOutdoorMetadata = assetsByName.get("GAB-OUT-STREET-002")?.metadata
    .exposureClassification as Record<string, unknown> | undefined;

  assert.equal(taggedOutdoorMetadata?.source, "nessus_tag");
  assert.equal(taggedOutdoorMetadata?.note, "Exposure classified from Nessus tag");
  assert.equal(taggedOutdoorMetadata?.label, "Outdoor GAB");
  assert.equal(inferredOutdoorMetadata?.source, "hostname_pattern");
  assert.equal(inferredOutdoorMetadata?.note, "Exposure inferred from hostname pattern");
  assert.equal(inferredOutdoorMetadata?.label, "Outdoor GAB");
});

test("Nessus parser rejects malformed XML before import processing", () => {
  assert.throws(
    () => parseNessusXml("<NessusClientData_v2><Report></NessusClientData_v2>"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "validation_error" &&
      /could not be parsed/i.test(error.message)
  );
});

test("Nessus parser rejects non-Nessus XML", () => {
  assert.throws(
    () => parseNessusXml("<root><ReportHost name=\"not-nessus\" /></root>"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "validation_error" &&
      /not a NessusClientData_v2 export/i.test(error.message)
  );
});

test("Nessus parser rejects XML entity expansion primitives", () => {
  assert.throws(
    () =>
      parseNessusXml(
        '<!DOCTYPE foo [<!ENTITY x "y">]><NessusClientData_v2></NessusClientData_v2>'
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "validation_error" &&
      /entity expansion/i.test(error.message)
  );
});
