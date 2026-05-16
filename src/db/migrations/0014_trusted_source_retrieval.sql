-- Fortexa trusted vulnerability source provenance.
-- Adds factual retrieval metadata to existing CVE source references.

ALTER TABLE "public"."cve_source_references"
  ADD COLUMN IF NOT EXISTS "retrieved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "supported_facts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "retrieval_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE "public"."cve_source_references"
SET
  "retrieved_at" = COALESCE("retrieved_at", "updated_at", now()),
  "supported_facts" = COALESCE(NULLIF("supported_facts", 'null'::jsonb), '[]'::jsonb),
  "retrieval_metadata" = COALESCE(NULLIF("retrieval_metadata", 'null'::jsonb), '{}'::jsonb)
WHERE
  "retrieved_at" IS NULL
  OR "supported_facts" = 'null'::jsonb
  OR "retrieval_metadata" = 'null'::jsonb;

DELETE FROM "public"."cve_source_references" duplicate
USING "public"."cve_source_references" keeper
WHERE duplicate.ctid < keeper.ctid
  AND duplicate."cve_id" = keeper."cve_id"
  AND duplicate."url" = keeper."url";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_cve_source_references_cve_url"
  ON "public"."cve_source_references" ("cve_id", "url");

CREATE INDEX IF NOT EXISTS "idx_cve_source_references_cve_type"
  ON "public"."cve_source_references" ("cve_id", "source_type");

NOTIFY pgrst, 'reload schema';
