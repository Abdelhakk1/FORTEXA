-- ============================================================================
-- Fortexa org-scoped import schema repair
-- Forward-only, idempotent repair for environments where organization-scoped
-- code deployed before the operational tables received organization_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "company_type" text NOT NULL DEFAULT 'other',
  "default_region" text,
  "default_country" text,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "onboarding_completed" boolean NOT NULL DEFAULT false,
  "onboarding_step" text NOT NULL DEFAULT 'workspace',
  "completed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "profile_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE cascade,
  "role" text NOT NULL DEFAULT 'owner',
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_org_member_profile" UNIQUE ("organization_id", "profile_id")
);

CREATE TABLE IF NOT EXISTS "public"."organization_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "operating_context" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sla_critical_days" integer NOT NULL DEFAULT 7,
  "sla_high_days" integer NOT NULL DEFAULT 14,
  "sla_medium_days" integer NOT NULL DEFAULT 30,
  "sla_low_days" integer NOT NULL DEFAULT 90,
  "ai_enabled" boolean NOT NULL DEFAULT false,
  "ai_consent_accepted" boolean NOT NULL DEFAULT false,
  "ai_data_policy" text NOT NULL DEFAULT 'minimal_evidence',
  "notifications" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "scanner_settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_org_settings_org" UNIQUE ("organization_id")
);

ALTER TABLE "public"."organizations"
  ALTER COLUMN "onboarding_step" SET DEFAULT 'workspace';
ALTER TABLE "public"."organization_settings"
  ALTER COLUMN "sla_low_days" SET DEFAULT 90;

ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."scan_imports" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."scan_findings" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."asset_vulnerabilities" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."asset_vulnerability_events" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."asset_vulnerability_enrichments" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."remediation_tasks" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."alerts" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."report_definitions" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."generated_reports" ADD COLUMN IF NOT EXISTS "organization_id" uuid;

DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id
  FROM public.organizations
  ORDER BY id ASC
  LIMIT 1;

  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (
      name,
      slug,
      company_type,
      timezone,
      onboarding_completed,
      onboarding_step,
      completed_at,
      metadata
    )
    VALUES (
      'Fortexa Workspace',
      'fortexa-workspace',
      'atm_operator',
      'Africa/Algiers',
      true,
      'complete',
      now(),
      '{"backfilled": true}'::jsonb
    )
    RETURNING id INTO default_org_id;
  END IF;

  INSERT INTO public.organization_settings (
    organization_id,
    operating_context,
    sla_critical_days,
    sla_high_days,
    sla_medium_days,
    sla_low_days,
    ai_enabled,
    ai_consent_accepted,
    notifications,
    scanner_settings
  )
  VALUES (
    default_org_id,
    '{"atmGabFleet": true, "vendorManagedSystems": false, "primaryEnvironment": "atm_gab_devices", "remediationOwnership": "we_remediate_directly", "operationalConstraints": [], "remediationPolicyPreset": "standard"}'::jsonb,
    7,
    14,
    30,
    90,
    false,
    false,
    '{"emailEnabled": false, "importFailures": true, "taskAssignments": true, "slaBreaches": true, "aiFailures": true, "dailyDigest": false}'::jsonb,
    '{"nessus": true, "openvas": false, "nmap": false, "qualys": false}'::jsonb
  )
  ON CONFLICT ("organization_id") DO NOTHING;

  INSERT INTO public.organization_members (organization_id, profile_id, role, status)
  SELECT default_org_id, p.id, 'owner', 'active'
  FROM public.profiles p
  ON CONFLICT ("organization_id", "profile_id") DO NOTHING;

  UPDATE public.assets SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.scan_imports SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.asset_vulnerabilities SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.asset_vulnerability_events SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.asset_vulnerability_enrichments SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.remediation_tasks SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.alerts SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.report_definitions SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.generated_reports SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Historical audit rows are intentionally not backfilled. audit_logs is
  -- append-only and its immutable trigger must continue to reject UPDATE/DELETE;
  -- existing rows may remain organization_id = NULL while new app writes include
  -- the active organization_id.

  UPDATE public.scan_findings sf
  SET organization_id = si.organization_id
  FROM public.scan_imports si
  WHERE sf.scan_import_id = si.id
    AND sf.organization_id IS NULL;

  UPDATE public.scan_findings SET organization_id = default_org_id WHERE organization_id IS NULL;
END
$$;

ALTER TABLE "public"."assets" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."scan_imports" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."scan_findings" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."asset_vulnerabilities" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."asset_vulnerability_events" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."asset_vulnerability_enrichments" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."remediation_tasks" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."alerts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."report_definitions" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."generated_reports" ALTER COLUMN "organization_id" SET NOT NULL;

-- Asset codes were originally globally unique. Once assets became
-- organization-scoped, that global constraint started blocking imports in a
-- second/backfilled workspace when generated codes such as AST-001 already
-- existed elsewhere. Keep the natural invariant, but scope it to the workspace.
DO $$
DECLARE
  asset_table regclass := to_regclass('public.assets');
  org_attnum smallint;
  code_attnum smallint;
  constraint_row record;
  index_row record;
  duplicate_count integer := 0;
BEGIN
  IF asset_table IS NULL THEN
    RAISE NOTICE 'Skipping asset_code uniqueness repair: public.assets is not present.';
  ELSE
    SELECT attnum INTO org_attnum
    FROM pg_attribute
    WHERE attrelid = asset_table
      AND attname = 'organization_id'
      AND NOT attisdropped;

    SELECT attnum INTO code_attnum
    FROM pg_attribute
    WHERE attrelid = asset_table
      AND attname = 'asset_code'
      AND NOT attisdropped;

    IF org_attnum IS NULL OR code_attnum IS NULL THEN
      RAISE NOTICE 'Skipping asset_code uniqueness repair: required columns are not present.';
    ELSE
      FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = asset_table
          AND contype = 'u'
          AND conkey = ARRAY[code_attnum]::smallint[]
      LOOP
        EXECUTE format(
          'ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS %I',
          constraint_row.conname
        );
      END LOOP;

      FOR index_row IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND i.indrelid = asset_table
          AND i.indisunique
          AND i.indkey::text = code_attnum::text
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', index_row.relname);
      END LOOP;

      SELECT count(*)::int INTO duplicate_count
      FROM (
        SELECT organization_id, asset_code
        FROM public.assets
        GROUP BY organization_id, asset_code
        HAVING count(*) > 1
      ) duplicates;

      IF duplicate_count = 0 THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "uq_assets_org_asset_code" ON "public"."assets" ("organization_id", "asset_code")';
      ELSE
        RAISE NOTICE 'Skipping uq_assets_org_asset_code: duplicate asset codes already exist inside at least one organization.';
      END IF;
    END IF;
  END IF;
END
$$;

DO $$
DECLARE
  fk record;
  local_table regclass;
  organizations_table regclass;
  local_org_attnum smallint;
  org_id_attnum smallint;
  matching_fk_exists boolean;
BEGIN
  organizations_table := to_regclass('public.organizations');

  FOR fk IN
    SELECT *
    FROM (
      VALUES
        ('assets', 'assets_organization_id_organizations_id_fk', 'cascade'),
        ('scan_imports', 'scan_imports_organization_id_organizations_id_fk', 'cascade'),
        ('scan_findings', 'scan_findings_organization_id_organizations_id_fk', 'cascade'),
        ('asset_vulnerabilities', 'asset_vulnerabilities_organization_id_organizations_id_fk', 'cascade'),
        ('asset_vulnerability_events', 'asset_vulnerability_events_organization_id_organizations_id_fk', 'cascade'),
        ('asset_vulnerability_enrichments', 'asset_vulnerability_enrichments_organization_id_organizations_id_fk', 'cascade'),
        ('remediation_tasks', 'remediation_tasks_organization_id_organizations_id_fk', 'cascade'),
        ('alerts', 'alerts_organization_id_organizations_id_fk', 'cascade'),
        ('audit_logs', 'audit_logs_organization_id_organizations_id_fk', 'set null'),
        ('report_definitions', 'report_definitions_organization_id_organizations_id_fk', 'cascade'),
        ('generated_reports', 'generated_reports_organization_id_organizations_id_fk', 'cascade')
    ) AS f(table_name, constraint_name, delete_action)
  LOOP
    local_table := to_regclass(format('public.%I', fk.table_name));
    local_org_attnum := NULL;
    org_id_attnum := NULL;
    matching_fk_exists := false;

    IF local_table IS NULL OR organizations_table IS NULL THEN
      RAISE NOTICE 'Skipping organization FK on %.organization_id: table is not present.', fk.table_name;
      CONTINUE;
    END IF;

    SELECT attnum INTO local_org_attnum
    FROM pg_attribute
    WHERE attrelid = local_table
      AND attname = 'organization_id'
      AND NOT attisdropped;

    SELECT attnum INTO org_id_attnum
    FROM pg_attribute
    WHERE attrelid = organizations_table
      AND attname = 'id'
      AND NOT attisdropped;

    IF local_org_attnum IS NULL OR org_id_attnum IS NULL THEN
      RAISE NOTICE 'Skipping organization FK on %.organization_id: required column is not present.', fk.table_name;
      CONTINUE;
    END IF;

    -- PostgreSQL truncates identifiers to 63 bytes, so a long requested
    -- constraint name can already exist under its truncated stored name. Also
    -- skip when any differently named FK already links organization_id to
    -- public.organizations(id), preventing duplicate relationship errors.
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid = local_table
        AND (
          c.conname = fk.constraint_name
          OR c.conname = left(fk.constraint_name, 63)
          OR (
            c.confrelid = organizations_table
            AND c.conkey = ARRAY[local_org_attnum]::smallint[]
            AND c.confkey = ARRAY[org_id_attnum]::smallint[]
          )
        )
    ) INTO matching_fk_exists;

    IF matching_fk_exists THEN
      RAISE NOTICE 'Skipping organization FK on %.organization_id: matching FK already exists.', fk.table_name;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE %s',
      fk.table_name,
      fk.constraint_name,
      fk.delete_action
    );
  END LOOP;
END
$$;

-- Defensive index creation for live schemas that may be between migration
-- generations. Optional columns are checked before use so this repair can be
-- pasted into Supabase SQL Editor without aborting on a missing report timestamp.
DO $$
BEGIN
  IF to_regclass('public.organization_members') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'profile_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_org_members_profile" ON "public"."organization_members" ("profile_id")';
  END IF;

  IF to_regclass('public.organization_members') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_org_members_org" ON "public"."organization_members" ("organization_id")';
  END IF;

  IF to_regclass('public.organization_settings') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_org_settings_org" ON "public"."organization_settings" ("organization_id")';
  END IF;

  IF to_regclass('public.assets') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_assets_org" ON "public"."assets" ("organization_id")';
  END IF;

  IF to_regclass('public.assets') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'asset_code')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_assets_org_asset_code" ON "public"."assets" ("organization_id", "asset_code")';
  END IF;

  IF to_regclass('public.assets') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'ip_address')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_assets_org_ip_not_null" ON "public"."assets" ("organization_id", "ip_address") WHERE "ip_address" IS NOT NULL';
  END IF;

  IF to_regclass('public.scan_imports') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_imports' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_imports_org" ON "public"."scan_imports" ("organization_id")';
  END IF;

  IF to_regclass('public.scan_imports') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_imports' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_imports' AND column_name = 'import_date')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_imports_org_date" ON "public"."scan_imports" ("organization_id", "import_date" DESC)';
  END IF;

  IF to_regclass('public.scan_findings') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_findings_org" ON "public"."scan_findings" ("organization_id")';
  END IF;

  IF to_regclass('public.scan_findings') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'scan_import_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'last_seen')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_findings_org_import_last_seen" ON "public"."scan_findings" ("organization_id", "scan_import_id", "last_seen" DESC)';
  END IF;

  IF to_regclass('public.scan_findings') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'matched_asset_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scan_findings' AND column_name = 'matched_cve_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_findings_org_asset_cve" ON "public"."scan_findings" ("organization_id", "matched_asset_id", "matched_cve_id")';
  END IF;

  IF to_regclass('public.asset_vulnerabilities') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_av_org" ON "public"."asset_vulnerabilities" ("organization_id")';
  END IF;

  IF to_regclass('public.asset_vulnerabilities') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'asset_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'cve_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_av_org_asset_cve" ON "public"."asset_vulnerabilities" ("organization_id", "asset_id", "cve_id")';
  END IF;

  IF to_regclass('public.asset_vulnerabilities') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'status')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'risk_score')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_av_org_status_risk" ON "public"."asset_vulnerabilities" ("organization_id", "status", "risk_score" DESC)';
  END IF;

  IF to_regclass('public.asset_vulnerabilities') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'sla_due')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_vulnerabilities' AND column_name = 'status')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_av_org_sla_actionable" ON "public"."asset_vulnerabilities" ("organization_id", "sla_due") WHERE "status" IN (''new'', ''open'', ''reopened'')';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_audit_org" ON "public"."audit_logs" ("organization_id")';
  END IF;

  IF to_regclass('public.alerts') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = 'status')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = 'created_at')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_alerts_org_status_created" ON "public"."alerts" ("organization_id", "status", "created_at" DESC)';
  END IF;

  -- generated_reports may have generated_at in the app schema, created_at in
  -- older experiments, or only organization_id in partially migrated databases.
  IF to_regclass('public.generated_reports') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'created_at')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_generated_reports_org_created" ON "public"."generated_reports" ("organization_id", "created_at" DESC)';
  ELSIF to_regclass('public.generated_reports') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'generated_at')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_generated_reports_org_generated_at" ON "public"."generated_reports" ("organization_id", "generated_at" DESC)';
  ELSIF to_regclass('public.generated_reports') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'organization_id')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_generated_reports_org" ON "public"."generated_reports" ("organization_id")';
  ELSE
    RAISE NOTICE 'Skipping generated_reports indexes: table or organization_id column is not present.';
  END IF;
END
$$;

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_settings" ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
