-- ============================================================================
-- Fortexa scalable GAB CIDT context
-- Adds inherited GAB CIDT templates, simple classification rules, and explicit
-- custom-CIDT override tracking on assets.
-- Forward-only and defensive for Supabase SQL Editor/manual application.
-- ============================================================================

ALTER TABLE "public"."assets"
  ADD COLUMN IF NOT EXISTS "cidt_override_enabled" boolean NOT NULL DEFAULT false;

UPDATE "public"."assets"
SET "cidt_override_enabled" = true
WHERE "cidt_override_enabled" = false
  AND "cidt_confidentiality" IS NOT NULL
  AND "cidt_integrity" IS NOT NULL
  AND "cidt_availability" IS NOT NULL
  AND "cidt_traceability" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_assets_org_cidt_override"
  ON "public"."assets" ("organization_id", "cidt_override_enabled");

CREATE TABLE IF NOT EXISTS "public"."gab_cidt_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "template_key" text NOT NULL,
  "label" text NOT NULL,
  "cidt_confidentiality" integer NOT NULL DEFAULT 3,
  "cidt_integrity" integer NOT NULL DEFAULT 3,
  "cidt_availability" integer NOT NULL DEFAULT 3,
  "cidt_traceability" integer NOT NULL DEFAULT 3,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "template_key" text;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "cidt_confidentiality" integer DEFAULT 3;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "cidt_integrity" integer DEFAULT 3;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "cidt_availability" integer DEFAULT 3;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "cidt_traceability" integer DEFAULT 3;
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE "public"."gab_cidt_templates" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

UPDATE "public"."gab_cidt_templates"
SET
  "label" = CASE "template_key"
    WHEN 'indoor_agency' THEN 'Indoor agency GAB template'
    WHEN 'outdoor_agency' THEN 'Outdoor agency GAB template'
    WHEN 'outdoor_public_commercial' THEN 'Outdoor public/commercial GAB template'
    ELSE coalesce("label", 'GAB CIDT template')
  END,
  "cidt_confidentiality" = coalesce("cidt_confidentiality", 3),
  "cidt_integrity" = coalesce("cidt_integrity", 3),
  "cidt_availability" = coalesce("cidt_availability", 3),
  "cidt_traceability" = coalesce("cidt_traceability", 3),
  "created_at" = coalesce("created_at", now()),
  "updated_at" = coalesce("updated_at", now());

DO $$
BEGIN
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "organization_id" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "template_key" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_confidentiality" SET DEFAULT 3;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_confidentiality" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_integrity" SET DEFAULT 3;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_integrity" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_availability" SET DEFAULT 3;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_availability" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_traceability" SET DEFAULT 3;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "cidt_traceability" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "public"."gab_cidt_templates" ALTER COLUMN "updated_at" SET NOT NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gab_cidt_templates'::regclass
      AND conname = 'gab_cidt_templates_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "public"."gab_cidt_templates"
      ADD CONSTRAINT "gab_cidt_templates_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gab_cidt_templates'::regclass
      AND conname = 'chk_gab_cidt_templates_key'
  ) THEN
    ALTER TABLE "public"."gab_cidt_templates"
      ADD CONSTRAINT "chk_gab_cidt_templates_key"
      CHECK ("template_key" IN ('indoor_agency', 'outdoor_agency', 'outdoor_public_commercial'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gab_cidt_templates'::regclass
      AND conname = 'chk_gab_cidt_templates_cidt_range'
  ) THEN
    ALTER TABLE "public"."gab_cidt_templates"
      ADD CONSTRAINT "chk_gab_cidt_templates_cidt_range"
      CHECK (
        "cidt_confidentiality" BETWEEN 1 AND 4
        AND "cidt_integrity" BETWEEN 1 AND 4
        AND "cidt_availability" BETWEEN 1 AND 4
        AND "cidt_traceability" BETWEEN 1 AND 4
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_gab_cidt_templates_org_key"
  ON "public"."gab_cidt_templates" ("organization_id", "template_key");
CREATE INDEX IF NOT EXISTS "idx_gab_cidt_templates_org"
  ON "public"."gab_cidt_templates" ("organization_id");

INSERT INTO "public"."gab_cidt_templates" (
  "organization_id",
  "template_key",
  "label",
  "cidt_confidentiality",
  "cidt_integrity",
  "cidt_availability",
  "cidt_traceability"
)
SELECT org.id, template.template_key, template.label, template.c, template.i, template.d, template.t
FROM "public"."organizations" org
CROSS JOIN (
  VALUES
    ('indoor_agency', 'Indoor agency GAB template', 3, 3, 3, 3),
    ('outdoor_agency', 'Outdoor agency GAB template', 3, 3, 4, 3),
    ('outdoor_public_commercial', 'Outdoor public/commercial GAB template', 3, 3, 4, 4)
) AS template(template_key, label, c, i, d, t)
ON CONFLICT ("organization_id", "template_key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "public"."asset_classification_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "field" text NOT NULL DEFAULT 'hostname',
  "match_operator" text NOT NULL DEFAULT 'contains',
  "match_value" text NOT NULL,
  "gab_exposure_type" "public"."gab_exposure_type" NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "field" text DEFAULT 'hostname';
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "match_operator" text DEFAULT 'contains';
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "match_value" text;
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "gab_exposure_type" "public"."gab_exposure_type";
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true;
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE "public"."asset_classification_rules" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

UPDATE "public"."asset_classification_rules"
SET
  "field" = coalesce("field", 'hostname'),
  "match_operator" = coalesce("match_operator", 'contains'),
  "enabled" = coalesce("enabled", true),
  "sort_order" = coalesce("sort_order", 0),
  "created_at" = coalesce("created_at", now()),
  "updated_at" = coalesce("updated_at", now());

DO $$
BEGIN
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "organization_id" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "field" SET DEFAULT 'hostname';
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "field" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "match_operator" SET DEFAULT 'contains';
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "match_operator" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "match_value" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "gab_exposure_type" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "enabled" SET DEFAULT true;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "enabled" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "sort_order" SET DEFAULT 0;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "sort_order" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "public"."asset_classification_rules" ALTER COLUMN "updated_at" SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.asset_classification_rules'::regclass
      AND conname = 'asset_classification_rules_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "public"."asset_classification_rules"
      ADD CONSTRAINT "asset_classification_rules_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.asset_classification_rules'::regclass
      AND conname = 'chk_asset_classification_rules_field'
  ) THEN
    ALTER TABLE "public"."asset_classification_rules"
      ADD CONSTRAINT "chk_asset_classification_rules_field"
      CHECK ("field" IN ('hostname', 'name', 'asset_code', 'branch', 'location'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.asset_classification_rules'::regclass
      AND conname = 'chk_asset_classification_rules_operator'
  ) THEN
    ALTER TABLE "public"."asset_classification_rules"
      ADD CONSTRAINT "chk_asset_classification_rules_operator"
      CHECK ("match_operator" = 'contains');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.asset_classification_rules'::regclass
      AND conname = 'chk_asset_classification_rules_match_value'
  ) THEN
    ALTER TABLE "public"."asset_classification_rules"
      ADD CONSTRAINT "chk_asset_classification_rules_match_value"
      CHECK (length(trim("match_value")) > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_asset_classification_rules_org_name"
  ON "public"."asset_classification_rules" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "idx_asset_classification_rules_org_enabled_order"
  ON "public"."asset_classification_rules" ("organization_id", "enabled", "sort_order");

ALTER TABLE "public"."gab_cidt_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."asset_classification_rules" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gab_cidt_templates_select_member" ON "public"."gab_cidt_templates";
CREATE POLICY "gab_cidt_templates_select_member"
  ON "public"."gab_cidt_templates"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "gab_cidt_templates_insert_member" ON "public"."gab_cidt_templates";
CREATE POLICY "gab_cidt_templates_insert_member"
  ON "public"."gab_cidt_templates"
  FOR INSERT
  TO authenticated
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "gab_cidt_templates_update_member" ON "public"."gab_cidt_templates";
CREATE POLICY "gab_cidt_templates_update_member"
  ON "public"."gab_cidt_templates"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"))
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "gab_cidt_templates_delete_member" ON "public"."gab_cidt_templates";
CREATE POLICY "gab_cidt_templates_delete_member"
  ON "public"."gab_cidt_templates"
  FOR DELETE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "asset_classification_rules_select_member" ON "public"."asset_classification_rules";
CREATE POLICY "asset_classification_rules_select_member"
  ON "public"."asset_classification_rules"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "asset_classification_rules_insert_member" ON "public"."asset_classification_rules";
CREATE POLICY "asset_classification_rules_insert_member"
  ON "public"."asset_classification_rules"
  FOR INSERT
  TO authenticated
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "asset_classification_rules_update_member" ON "public"."asset_classification_rules";
CREATE POLICY "asset_classification_rules_update_member"
  ON "public"."asset_classification_rules"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"))
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "asset_classification_rules_delete_member" ON "public"."asset_classification_rules";
CREATE POLICY "asset_classification_rules_delete_member"
  ON "public"."asset_classification_rules"
  FOR DELETE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

NOTIFY pgrst, 'reload schema';
