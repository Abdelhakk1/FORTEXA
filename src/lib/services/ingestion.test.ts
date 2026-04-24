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
