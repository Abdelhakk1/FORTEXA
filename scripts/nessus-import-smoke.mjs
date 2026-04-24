import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import "dotenv/config";

const fixturePath =
  process.env.FORTEXA_NESSUS_FIXTURE ||
  "./fixtures/sample-nessus-import.nessus";

const scanImportsModule = await import("../src/lib/services/scan-imports.ts");
const ingestionModule = await import("../src/lib/services/ingestion.ts");
const { createScanImportRecord } =
  scanImportsModule.default ?? scanImportsModule;
const { processScanImport } = ingestionModule.default ?? ingestionModule;
const xmlText = await readFile(fixturePath, "utf8");

const record = await createScanImportRecord({
  name: `Perf Smoke Nessus ${new Date().toISOString()}`,
  scannerSource: "nessus",
  fileName: fixturePath.split("/").at(-1) || "sample-nessus-import.nessus",
  fileSize: Buffer.byteLength(xmlText, "utf8"),
  storagePath: null,
  importedBy: null,
});

const result = await processScanImport(record.id, {
  xmlText,
  initialWarnings: ["smoke-check"],
});

console.log(
  JSON.stringify(
    {
      scanImportId: record.id,
      status: result.status,
      createdAssets: result.createdAssets,
      createdFindings: result.createdFindings,
      createdVulnerabilities: result.createdVulnerabilities,
      warnings: result.warnings.length,
      errors: result.errors.length,
    },
    null,
    2
  )
);
