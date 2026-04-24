ALTER TYPE "public"."vulnerability_status" ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE "public"."vulnerability_status" ADD VALUE IF NOT EXISTS 'reopened';
ALTER TYPE "public"."vulnerability_status" ADD VALUE IF NOT EXISTS 'false_positive';
ALTER TYPE "public"."vulnerability_status" ADD VALUE IF NOT EXISTS 'compensating_control';

DO $$
BEGIN
  CREATE TYPE "public"."asset_vulnerability_event_type" AS ENUM (
    'introduced',
    'unchanged',
    'fixed',
    'reopened',
    'status_changed',
    'task_linked',
    'task_completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "public"."scan_imports"
  ADD COLUMN IF NOT EXISTS "matched_assets" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "new_findings" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fixed_findings" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reopened_findings" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unchanged_findings" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "low_confidence_matches" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."cve_enrichments"
  ADD COLUMN IF NOT EXISTS "ai_provider" text,
  ADD COLUMN IF NOT EXISTS "prompt_version" text,
  ADD COLUMN IF NOT EXISTS "validation_passed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "citations" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "unsupported_claims" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "trust_labels" jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "public"."asset_vulnerability_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_vulnerability_id" uuid NOT NULL REFERENCES "public"."asset_vulnerabilities"("id") ON DELETE cascade,
  "event_type" "public"."asset_vulnerability_event_type" NOT NULL,
  "before_status" "public"."vulnerability_status",
  "after_status" "public"."vulnerability_status",
  "risk_score" integer,
  "business_priority" "public"."business_priority",
  "scan_import_id" uuid REFERENCES "public"."scan_imports"("id") ON DELETE set null,
  "actor_profile_id" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
  "details" jsonb,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_av_events_asset" ON "public"."asset_vulnerability_events" USING btree ("asset_vulnerability_id");
CREATE INDEX IF NOT EXISTS "idx_av_events_type" ON "public"."asset_vulnerability_events" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "idx_av_events_import" ON "public"."asset_vulnerability_events" USING btree ("scan_import_id");
CREATE INDEX IF NOT EXISTS "idx_av_events_created" ON "public"."asset_vulnerability_events" USING btree ("created_at");

CREATE TABLE IF NOT EXISTS "public"."asset_vulnerability_enrichments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_vulnerability_id" uuid NOT NULL UNIQUE REFERENCES "public"."asset_vulnerabilities"("id") ON DELETE cascade,
  "summary" text,
  "technical_rationale" text,
  "business_rationale" text,
  "primary_mitigation" text,
  "recommended_actions" jsonb DEFAULT '[]'::jsonb,
  "validation_steps" jsonb DEFAULT '[]'::jsonb,
  "compensating_controls" jsonb DEFAULT '[]'::jsonb,
  "rollback_caution" text,
  "maintenance_window_note" text,
  "citations" jsonb DEFAULT '[]'::jsonb,
  "unsupported_claims" jsonb DEFAULT '[]'::jsonb,
  "trust_labels" jsonb DEFAULT '[]'::jsonb,
  "confidence_score" integer,
  "enrichment_status" "public"."enrichment_status" NOT NULL DEFAULT 'pending',
  "ai_model" text,
  "ai_provider" text,
  "ai_error" text,
  "input_hash" text,
  "prompt_version" text,
  "validation_passed" boolean NOT NULL DEFAULT false,
  "enriched_at" timestamp with time zone,
  "enrichment_source" "public"."enrichment_source" NOT NULL DEFAULT 'ai',
  "enriched_by" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."asset_vulnerability_enrichments"
  ADD COLUMN IF NOT EXISTS "primary_mitigation" text,
  ADD COLUMN IF NOT EXISTS "validation_steps" jsonb DEFAULT '[]'::jsonb;

DROP INDEX IF EXISTS "public"."idx_av_sla_open";
CREATE INDEX IF NOT EXISTS "idx_av_sla_actionable"
  ON "public"."asset_vulnerabilities" USING btree ("sla_due")
  WHERE "status" IN ('new', 'open', 'reopened');
