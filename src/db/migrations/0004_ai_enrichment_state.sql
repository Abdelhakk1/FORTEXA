DO $$
BEGIN
  CREATE TYPE "public"."enrichment_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "public"."cve_enrichments"
  ADD COLUMN IF NOT EXISTS "summary" text,
  ADD COLUMN IF NOT EXISTS "enrichment_status" "public"."enrichment_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "ai_model" text,
  ADD COLUMN IF NOT EXISTS "ai_error" text,
  ADD COLUMN IF NOT EXISTS "source_fingerprint" text,
  ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "enriched_at" timestamp with time zone;
