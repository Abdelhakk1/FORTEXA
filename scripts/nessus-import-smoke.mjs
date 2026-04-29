import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const fixturePath =
  process.env.FORTEXA_NESSUS_FIXTURE ||
  "./fixtures/sample-nessus-import.nessus";

const [
  drizzleOrm,
  dbModule,
  schemaModule,
  scanImportsModule,
  ingestionModule,
] = await Promise.all([
  import("drizzle-orm"),
  import("../src/db/index.ts"),
  import("../src/db/schema/index.ts"),
  import("../src/lib/services/scan-imports.ts"),
  import("../src/lib/services/ingestion.ts"),
]);

const { eq } = drizzleOrm;
const { getDb } = dbModule.default ?? dbModule;
const {
  alerts,
  assets,
  assetVulnerabilityEnrichments,
  assetVulnerabilityEvents,
  assetVulnerabilities,
  organizations,
  organizationSettings,
  reportDefinitions,
  scanFindings,
  scanImports,
} = schemaModule.default ?? schemaModule;
const { createScanImportRecord } = scanImportsModule.default ?? scanImportsModule;
const { processScanImport } = ingestionModule.default ?? ingestionModule;
const db = getDb();

if (!db) {
  throw new Error("Missing DATABASE_URL. Add it to .env.local or the environment.");
}

const suffix = randomUUID().slice(0, 8);
const xmlText = await readFile(fixturePath, "utf8");
let organizationId = null;

try {
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Fortexa Nessus Smoke ${suffix}`,
      slug: `fortexa-nessus-smoke-${suffix}`,
      companyType: "atm_operator",
      timezone: "UTC",
      onboardingCompleted: true,
      onboardingStep: "complete",
      completedAt: new Date(),
      metadata: { smoke: true },
    })
    .returning();

  organizationId = organization.id;

  await db.insert(organizationSettings).values({
    organizationId,
    operatingContext: {
      primaryEnvironment: "atm_gab_devices",
      remediationOwnership: "we_remediate_directly",
      operationalConstraints: [],
      remediationPolicyPreset: "standard",
    },
    aiEnabled: false,
    aiConsentAccepted: false,
    aiDataPolicy: "minimal_evidence",
    notifications: { slaBreaches: true },
    scannerSettings: { nessus: true },
  });

  const record = await createScanImportRecord({
    organizationId,
    name: `Smoke Nessus ${new Date().toISOString()}`,
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

  if (result.status === "failed") {
    throw new Error(`Nessus import smoke failed: ${result.errors.join("; ")}`);
  }

  const [assetRows, findingRows, avRows] = await Promise.all([
    db.select({ id: assets.id }).from(assets).where(eq(assets.organizationId, organizationId)),
    db
      .select({ id: scanFindings.id })
      .from(scanFindings)
      .where(eq(scanFindings.organizationId, organizationId)),
    db
      .select({ id: assetVulnerabilities.id })
      .from(assetVulnerabilities)
      .where(eq(assetVulnerabilities.organizationId, organizationId)),
  ]);

  if (assetRows.length === 0 || findingRows.length === 0 || avRows.length === 0) {
    throw new Error("Smoke import did not create org-scoped assets, findings, and asset vulnerabilities.");
  }

  console.log(
    JSON.stringify(
      {
        result: "passed",
        aiEnabled: false,
        scanImportId: record.id,
        status: result.status,
        createdAssets: result.createdAssets,
        createdFindings: result.createdFindings,
        createdVulnerabilities: result.createdVulnerabilities,
        orgScopedAssets: assetRows.length,
        orgScopedFindings: findingRows.length,
        orgScopedAssetVulnerabilities: avRows.length,
        warnings: result.warnings.length,
        errors: result.errors.length,
      },
      null,
      2
    )
  );
} catch (error) {
  const cause =
    error && typeof error === "object" && "cause" in error
      ? error.cause
      : null;
  console.error(
    JSON.stringify(
      {
        result: "failed",
        reason:
          cause && typeof cause === "object" && "code" in cause
            ? "database_unreachable"
            : "import_smoke_failed",
        code:
          cause && typeof cause === "object" && "code" in cause
            ? cause.code
            : error && typeof error === "object" && "code" in error
              ? error.code
              : "unknown",
        message:
          cause instanceof Error
            ? cause.message
            : error instanceof Error
              ? error.message
              : "Unknown Nessus import smoke failure.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  if (organizationId) {
    await db.delete(scanFindings).where(eq(scanFindings.organizationId, organizationId));
    await db
      .delete(assetVulnerabilityEvents)
      .where(eq(assetVulnerabilityEvents.organizationId, organizationId));
    await db
      .delete(assetVulnerabilityEnrichments)
      .where(eq(assetVulnerabilityEnrichments.organizationId, organizationId));
    await db.delete(alerts).where(eq(alerts.organizationId, organizationId));
    await db
      .delete(assetVulnerabilities)
      .where(eq(assetVulnerabilities.organizationId, organizationId));
    await db.delete(scanImports).where(eq(scanImports.organizationId, organizationId));
    await db
      .delete(reportDefinitions)
      .where(eq(reportDefinitions.organizationId, organizationId));
    await db.delete(assets).where(eq(assets.organizationId, organizationId));
    await db
      .delete(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
}
