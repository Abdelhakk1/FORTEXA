-- ============================================================================
-- Fortexa AI Enrichment Lease Metadata
-- Adds non-destructive lease/retry fields so stale processing rows can be
-- recovered without allowing older workers to overwrite newer retry results.
-- ============================================================================

ALTER TABLE "public"."asset_vulnerability_enrichments"
  ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "processing_lease_id" text,
  ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_attempted_at" timestamp with time zone;

ALTER TABLE "public"."cve_enrichments"
  ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "processing_lease_id" text,
  ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_attempted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_av_enrichments_processing_stale"
  ON "public"."asset_vulnerability_enrichments" ("processing_started_at")
  WHERE "enrichment_status" = 'processing';

CREATE INDEX IF NOT EXISTS "idx_cve_enrichments_processing_stale"
  ON "public"."cve_enrichments" ("processing_started_at")
  WHERE "enrichment_status" = 'processing';
