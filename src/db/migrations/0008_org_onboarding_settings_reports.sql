-- ============================================================================
-- Fortexa P0 Organization, Onboarding, Settings, and Report Foundation
-- Forward-only migration. Existing single-tenant data is assigned to a default
-- organization so current users keep working after deploy.
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
  "onboarding_step" text NOT NULL DEFAULT 'organization',
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
  "sla_low_days" integer NOT NULL DEFAULT 60,
  "ai_enabled" boolean NOT NULL DEFAULT false,
  "ai_consent_accepted" boolean NOT NULL DEFAULT false,
  "ai_data_policy" text NOT NULL DEFAULT 'minimal_evidence',
  "notifications" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "scanner_settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_org_settings_org" UNIQUE ("organization_id")
);

CREATE TABLE IF NOT EXISTS "public"."sites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "site_type" text NOT NULL DEFAULT 'branch_network',
  "region_name" text,
  "country" text,
  "location" text,
  "timezone" text,
  "vendor_managed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_sites_org_code" UNIQUE ("organization_id", "code")
);

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
  ORDER BY created_at ASC
  LIMIT 1;

  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (
      name,
      slug,
      company_type,
      default_region,
      default_country,
      timezone,
      onboarding_completed,
      onboarding_step,
      completed_at,
      metadata
    )
    VALUES (
      'Fortexa Workspace',
      'fortexa-workspace',
      'bank',
      'Central Operations',
      'Algeria',
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
    ai_enabled,
    ai_consent_accepted,
    notifications,
    scanner_settings
  )
  VALUES (
    default_org_id,
    '{"atmGabFleet": true, "branchNetwork": true, "edgeInfrastructure": true, "vendorManagedSystems": false}'::jsonb,
    false,
    false,
    '{"emailEnabled": false, "importFailures": true, "taskAssignments": true, "slaBreaches": true, "aiFailures": true, "dailyDigest": false}'::jsonb,
    '{"nessus": true, "openvas": false, "nmap": false, "qualys": false}'::jsonb
  )
  ON CONFLICT ("organization_id") DO NOTHING;

  INSERT INTO public.sites (
    organization_id,
    name,
    code,
    site_type,
    region_name,
    country,
    timezone
  )
  VALUES (
    default_org_id,
    'Central Operations',
    'CENTRAL',
    'branch_network',
    'Central Operations',
    'Algeria',
    'Africa/Algiers'
  )
  ON CONFLICT ("organization_id", "code") DO NOTHING;

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

  UPDATE public.scan_findings sf
  SET organization_id = si.organization_id
  FROM public.scan_imports si
  WHERE sf.scan_import_id = si.id AND sf.organization_id IS NULL;

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

ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."scan_imports" ADD CONSTRAINT "scan_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."scan_findings" ADD CONSTRAINT "scan_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."asset_vulnerability_events" ADD CONSTRAINT "asset_vulnerability_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."asset_vulnerability_enrichments" ADD CONSTRAINT "asset_vulnerability_enrichments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."remediation_tasks" ADD CONSTRAINT "remediation_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null;
ALTER TABLE "public"."report_definitions" ADD CONSTRAINT "report_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "public"."generated_reports" ADD CONSTRAINT "generated_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "idx_organizations_onboarding" ON "public"."organizations" ("onboarding_completed");
CREATE INDEX IF NOT EXISTS "idx_org_members_profile" ON "public"."organization_members" ("profile_id");
CREATE INDEX IF NOT EXISTS "idx_org_members_org" ON "public"."organization_members" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_sites_org" ON "public"."sites" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_assets_org" ON "public"."assets" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_imports_org" ON "public"."scan_imports" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_findings_org" ON "public"."scan_findings" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_av_org" ON "public"."asset_vulnerabilities" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_av_events_org" ON "public"."asset_vulnerability_events" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_rem_org" ON "public"."remediation_tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_alerts_org" ON "public"."alerts" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_audit_org" ON "public"."audit_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_report_definitions_org" ON "public"."report_definitions" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_generated_reports_org" ON "public"."generated_reports" ("organization_id");

DO $$
DECLARE
  table_name text;
  org_tables text[] := ARRAY[
    'organizations',
    'organization_members',
    'organization_settings',
    'sites'
  ];
BEGIN
  FOREACH table_name IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
  END LOOP;
END
$$;
