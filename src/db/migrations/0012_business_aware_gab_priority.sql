-- ============================================================================
-- Fortexa business-aware GAB vulnerability priority
-- Adds CIDT, GAB exposure, and the single ATM Payment Services context.
-- Forward-only and defensive for Supabase SQL Editor/manual application.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gab_exposure_type') THEN
    CREATE TYPE "public"."gab_exposure_type" AS ENUM (
      'unknown',
      'indoor_agency',
      'outdoor_agency',
      'outdoor_commercial_center',
      'outdoor_public_street'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."business_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "key" text NOT NULL DEFAULT 'monetique',
  "label" text NOT NULL DEFAULT 'ATM Payment Services',
  "cidt_confidentiality" integer NOT NULL DEFAULT 4,
  "cidt_integrity" integer NOT NULL DEFAULT 4,
  "cidt_availability" integer NOT NULL DEFAULT 4,
  "cidt_traceability" integer NOT NULL DEFAULT 4,
  "is_internet_exposed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "key" text DEFAULT 'monetique';
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "label" text DEFAULT 'ATM Payment Services';
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "cidt_confidentiality" integer DEFAULT 4;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "cidt_integrity" integer DEFAULT 4;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "cidt_availability" integer DEFAULT 4;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "cidt_traceability" integer DEFAULT 4;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "is_internet_exposed" boolean DEFAULT false;
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE "public"."business_applications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

UPDATE "public"."business_applications"
SET "key" = 'monetique'
WHERE "key" IS NULL;

UPDATE "public"."business_applications"
SET "label" = 'ATM Payment Services'
WHERE "label" IS NULL OR lower("label") IN ('monetique', 'monétique');

DELETE FROM "public"."business_applications"
WHERE "organization_id" IS NULL;

UPDATE "public"."business_applications"
SET
  "cidt_confidentiality" = coalesce("cidt_confidentiality", 4),
  "cidt_integrity" = coalesce("cidt_integrity", 4),
  "cidt_availability" = coalesce("cidt_availability", 4),
  "cidt_traceability" = coalesce("cidt_traceability", 4),
  "is_internet_exposed" = coalesce("is_internet_exposed", false),
  "created_at" = coalesce("created_at", now()),
  "updated_at" = coalesce("updated_at", now());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_applications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "public"."business_applications" ALTER COLUMN "organization_id" SET NOT NULL;
  END IF;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "key" SET DEFAULT 'monetique';
  ALTER TABLE "public"."business_applications" ALTER COLUMN "key" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "label" SET DEFAULT 'ATM Payment Services';
  ALTER TABLE "public"."business_applications" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_confidentiality" SET DEFAULT 4;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_confidentiality" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_integrity" SET DEFAULT 4;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_integrity" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_availability" SET DEFAULT 4;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_availability" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_traceability" SET DEFAULT 4;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "cidt_traceability" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "is_internet_exposed" SET DEFAULT false;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "is_internet_exposed" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "public"."business_applications" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "public"."business_applications" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "public"."business_applications" ALTER COLUMN "updated_at" SET NOT NULL;
END
$$;

DO $$
DECLARE
  fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_applications'::regclass
      AND contype = 'f'
      AND conname = 'business_applications_organization_id_organizations_id_fk'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE "public"."business_applications"
      ADD CONSTRAINT "business_applications_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_applications'::regclass
      AND conname = 'chk_business_applications_single_key'
  ) THEN
    ALTER TABLE "public"."business_applications"
      ADD CONSTRAINT "chk_business_applications_single_key"
      CHECK ("key" = 'monetique');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_applications'::regclass
      AND conname = 'chk_business_applications_cidt_range'
  ) THEN
    ALTER TABLE "public"."business_applications"
      ADD CONSTRAINT "chk_business_applications_cidt_range"
      CHECK (
        "cidt_confidentiality" BETWEEN 1 AND 4
        AND "cidt_integrity" BETWEEN 1 AND 4
        AND "cidt_availability" BETWEEN 1 AND 4
        AND "cidt_traceability" BETWEEN 1 AND 4
      );
  END IF;
END
$$;

DO $$
DECLARE
  duplicate_count integer := 0;
BEGIN
  SELECT count(*)::int INTO duplicate_count
  FROM (
    SELECT organization_id, key
    FROM public.business_applications
    GROUP BY organization_id, key
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_business_applications_org_key"
      ON "public"."business_applications" ("organization_id", "key");
  ELSE
    RAISE NOTICE 'Skipping uq_business_applications_org_key: duplicate application keys already exist.';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_business_applications_org"
  ON "public"."business_applications" ("organization_id");

INSERT INTO "public"."business_applications" (
  "organization_id",
  "key",
  "label",
  "cidt_confidentiality",
  "cidt_integrity",
  "cidt_availability",
  "cidt_traceability",
  "is_internet_exposed"
)
SELECT
  org.id,
  'monetique',
  'ATM Payment Services',
  4,
  4,
  4,
  4,
  false
FROM "public"."organizations" org
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."business_applications" existing
  WHERE existing.organization_id = org.id
    AND existing.key = 'monetique'
);

UPDATE "public"."business_applications"
SET "label" = 'ATM Payment Services',
    "updated_at" = now()
WHERE "key" = 'monetique'
  AND "label" <> 'ATM Payment Services';

ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "gab_exposure_type" "public"."gab_exposure_type" DEFAULT 'unknown';
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "cidt_confidentiality" integer;
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "cidt_integrity" integer;
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "cidt_availability" integer;
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "cidt_traceability" integer;
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "business_application_id" uuid;

UPDATE "public"."assets"
SET "gab_exposure_type" = 'unknown'
WHERE "gab_exposure_type" IS NULL;

ALTER TABLE "public"."assets" ALTER COLUMN "gab_exposure_type" SET DEFAULT 'unknown';
ALTER TABLE "public"."assets" ALTER COLUMN "gab_exposure_type" SET NOT NULL;

UPDATE "public"."assets" a
SET "business_application_id" = ba.id
FROM "public"."business_applications" ba
WHERE ba.organization_id = a.organization_id
  AND ba.key = 'monetique'
  AND a.business_application_id IS NULL;

DO $$
DECLARE
  fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.assets'::regclass
      AND contype = 'f'
      AND conname = 'assets_business_application_id_business_applications_id_fk'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE "public"."assets"
      ADD CONSTRAINT "assets_business_application_id_business_applications_id_fk"
      FOREIGN KEY ("business_application_id") REFERENCES "public"."business_applications"("id") ON DELETE set null;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assets'::regclass
      AND conname = 'chk_assets_cidt_range'
  ) THEN
    ALTER TABLE "public"."assets"
      ADD CONSTRAINT "chk_assets_cidt_range"
      CHECK (
        ("cidt_confidentiality" IS NULL OR "cidt_confidentiality" BETWEEN 1 AND 4)
        AND ("cidt_integrity" IS NULL OR "cidt_integrity" BETWEEN 1 AND 4)
        AND ("cidt_availability" IS NULL OR "cidt_availability" BETWEEN 1 AND 4)
        AND ("cidt_traceability" IS NULL OR "cidt_traceability" BETWEEN 1 AND 4)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_assets_org_gab_exposure"
  ON "public"."assets" ("organization_id", "gab_exposure_type");
CREATE INDEX IF NOT EXISTS "idx_assets_business_application"
  ON "public"."assets" ("business_application_id");

ALTER TABLE "public"."asset_vulnerabilities" ADD COLUMN IF NOT EXISTS "priority_factors" jsonb;

WITH scored AS (
  SELECT
    av.id,
    c.severity,
    c.cvss_score,
    c.exploit_maturity,
    greatest(
      coalesce(a.cidt_confidentiality, 2),
      coalesce(a.cidt_integrity, 2),
      coalesce(a.cidt_availability, 2),
      coalesce(a.cidt_traceability, 2)
    ) AS asset_sensitivity,
    greatest(
      coalesce(ba.cidt_confidentiality, 4),
      coalesce(ba.cidt_integrity, 4),
      coalesce(ba.cidt_availability, 4),
      coalesce(ba.cidt_traceability, 4)
    ) AS application_sensitivity,
    CASE
      WHEN coalesce(ba.is_internet_exposed, false) THEN 4
      WHEN coalesce(ba.cidt_confidentiality, 4) = 4 OR coalesce(ba.cidt_integrity, 4) = 4 THEN 3
      WHEN coalesce(ba.cidt_confidentiality, 4) = 3 OR coalesce(ba.cidt_integrity, 4) = 3 THEN 2
      ELSE 1
    END AS application_profile,
    coalesce(a.gab_exposure_type::text, 'unknown') AS gab_exposure_type,
    CASE coalesce(a.gab_exposure_type::text, 'unknown')
      WHEN 'indoor_agency' THEN 50
      WHEN 'outdoor_agency' THEN 70
      WHEN 'outdoor_commercial_center' THEN 85
      WHEN 'outdoor_public_street' THEN 95
      ELSE 45
    END AS gab_exposure_score,
    CASE c.exploit_maturity
      WHEN 'active_in_wild' THEN 100
      WHEN 'poc_available' THEN 78
      WHEN 'theoretical' THEN 45
      ELSE 10
    END AS exploit_score,
    CASE
      WHEN c.cvss_score IS NOT NULL THEN least(100, round((c.cvss_score::numeric * 10))::int)
      WHEN c.severity = 'critical' THEN 95
      WHEN c.severity = 'high' THEN 80
      WHEN c.severity = 'medium' THEN 55
      WHEN c.severity = 'low' THEN 28
      ELSE 8
    END AS severity_score
  FROM "public"."asset_vulnerabilities" av
  INNER JOIN "public"."assets" a ON a.id = av.asset_id
  INNER JOIN "public"."cves" c ON c.id = av.cve_id
  LEFT JOIN "public"."business_applications" ba
    ON ba.id = a.business_application_id
    OR (ba.organization_id = av.organization_id AND ba.key = 'monetique')
),
prioritized AS (
  SELECT
    id,
    least(
      100,
      greatest(
        0,
        round(
          severity_score * 0.32
          + exploit_score * 0.13
          + (asset_sensitivity * 25) * 0.15
          + (application_sensitivity * 25) * 0.16
          + (application_profile * 25) * 0.12
          + gab_exposure_score * 0.12
        )::int
      )
    ) AS risk_score,
    severity,
    asset_sensitivity,
    application_sensitivity,
    application_profile,
    gab_exposure_type,
    severity_score,
    exploit_score,
    gab_exposure_score
  FROM scored
)
UPDATE "public"."asset_vulnerabilities" av
SET
  "risk_score" = prioritized.risk_score,
  "business_priority" = CASE
    WHEN prioritized.risk_score >= 90 THEN 'p1'::business_priority
    WHEN prioritized.risk_score >= 75 THEN 'p2'::business_priority
    WHEN prioritized.risk_score >= 60 THEN 'p3'::business_priority
    WHEN prioritized.risk_score >= 40 THEN 'p4'::business_priority
    ELSE 'p5'::business_priority
  END,
  "priority_factors" = jsonb_build_object(
    'applicationLabel', 'ATM Payment Services',
    'summary',
      prioritized.severity || ' severity + S' || prioritized.asset_sensitivity
      || ' GAB sensitivity + S' || prioritized.application_sensitivity
      || ' ATM Payment Services sensitivity + Profile ' || prioritized.application_profile
      || ' + ' || replace(prioritized.gab_exposure_type, '_', ' '),
    'technicalSeverity', prioritized.severity,
    'assetSensitivity', 'S' || prioritized.asset_sensitivity,
    'applicationSensitivity', 'S' || prioritized.application_sensitivity,
    'applicationProfile', 'Profile ' || prioritized.application_profile,
    'gabExposure', replace(prioritized.gab_exposure_type, '_', ' '),
    'businessImpact', 'This GAB supports ATM Payment Services. CIDT and physical exposure influence the business impact of exploitation or outage.',
    'remediationUrgency', CASE
      WHEN prioritized.risk_score >= 90 THEN 'Fix immediately under the emergency or accelerated change process.'
      WHEN prioritized.risk_score >= 75 THEN 'Fix in the next approved change window with active follow-up.'
      WHEN prioritized.risk_score >= 60 THEN 'Schedule remediation promptly and track it through the normal SLA.'
      WHEN prioritized.risk_score >= 40 THEN 'Plan remediation after higher-priority ATM Payment Services risks.'
      ELSE 'Monitor and remediate when bundled with routine maintenance.'
    END,
    'missingContext', '[]'::jsonb,
    'scoringInputs', jsonb_build_object(
      'severityScore', prioritized.severity_score,
      'exploitScore', prioritized.exploit_score,
      'assetSensitivityScore', prioritized.asset_sensitivity * 25,
      'applicationSensitivityScore', prioritized.application_sensitivity * 25,
      'applicationProfileScore', prioritized.application_profile * 25,
      'gabExposureScore', prioritized.gab_exposure_score
    )
  ),
  "updated_at" = now()
FROM prioritized
WHERE av.id = prioritized.id;

ALTER TABLE "public"."business_applications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_applications_select_member" ON "public"."business_applications";
CREATE POLICY "business_applications_select_member"
  ON "public"."business_applications"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "business_applications_insert_member" ON "public"."business_applications";
CREATE POLICY "business_applications_insert_member"
  ON "public"."business_applications"
  FOR INSERT
  TO authenticated
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "business_applications_update_member" ON "public"."business_applications";
CREATE POLICY "business_applications_update_member"
  ON "public"."business_applications"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"))
  WITH CHECK (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "business_applications_delete_member" ON "public"."business_applications";
CREATE POLICY "business_applications_delete_member"
  ON "public"."business_applications"
  FOR DELETE
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

NOTIFY pgrst, 'reload schema';
