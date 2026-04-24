import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ eq }, { getDb }, schema, { runAssetVulnerabilityEnrichment }] =
    await Promise.all([
      import("drizzle-orm"),
      import("@/db"),
      import("@/db/schema"),
      import("@/lib/services/asset-vulnerability-enrichment"),
    ]);
  const { assetVulnerabilityEnrichments, assetVulnerabilities } = schema;
  const db = getDb();

  if (!db) {
    console.log(
      JSON.stringify({
        result: "failed",
        reason: "database_unavailable",
      })
    );
    process.exit(1);
  }

  const requestedId = process.argv[2] ?? process.env.ASSET_VULNERABILITY_ID;
  const assetVulnerabilityId =
    requestedId ||
    (
      await db
        .select({ id: assetVulnerabilities.id })
        .from(assetVulnerabilities)
        .limit(1)
    )[0]?.id;

  if (!assetVulnerabilityId) {
    console.log(
      JSON.stringify({
        result: "failed",
        reason: "no_asset_vulnerability_found",
      })
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  const enrichmentResult = await runAssetVulnerabilityEnrichment(
    assetVulnerabilityId,
    { force: true }
  );
  const elapsedMs = Date.now() - startedAt;

  const [row] = await db
    .select({
      enrichmentStatus: assetVulnerabilityEnrichments.enrichmentStatus,
      aiError: assetVulnerabilityEnrichments.aiError,
      aiModel: assetVulnerabilityEnrichments.aiModel,
      aiProvider: assetVulnerabilityEnrichments.aiProvider,
      validationPassed: assetVulnerabilityEnrichments.validationPassed,
      summary: assetVulnerabilityEnrichments.summary,
    })
    .from(assetVulnerabilityEnrichments)
    .where(
      eq(
        assetVulnerabilityEnrichments.assetVulnerabilityId,
        assetVulnerabilityId
      )
    )
    .limit(1);

  const payload = {
    assetVulnerabilityId,
    elapsedMs,
    result: enrichmentResult.ok ? enrichmentResult.data.status : "failed",
    message: enrichmentResult.ok ? null : enrichmentResult.message,
    db: row
      ? {
          status: row.enrichmentStatus,
          aiError: row.aiError,
          aiModel: row.aiModel,
          aiProvider: row.aiProvider,
          validationPassed: row.validationPassed,
          hasSummary: Boolean(row.summary),
        }
      : null,
  };

  console.log(JSON.stringify(payload));
  process.exit(enrichmentResult.ok ? 0 : 1);
}

main().catch((error) => {
  console.log(
    JSON.stringify({
      result: "failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    })
  );
  process.exit(1);
});
