-- ============================================================================
-- Fortexa Security Hardening
-- Applies RLS/grant protection to app-owned public tables and makes audit
-- resource identifiers compatible with non-UUID import/system resources.
-- ============================================================================

ALTER TABLE "public"."audit_logs"
  ALTER COLUMN "resource_id" TYPE text USING "resource_id"::text;

DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'roles',
    'profiles',
    'regions',
    'assets',
    'cves',
    'cve_enrichments',
    'cve_source_references',
    'cve_recommended_controls',
    'asset_vulnerabilities',
    'asset_vulnerability_events',
    'asset_vulnerability_enrichments',
    'scan_imports',
    'scan_findings',
    'remediation_tasks',
    'alerts',
    'scoring_policies',
    'audit_logs',
    'report_definitions',
    'generated_reports'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    ALTER FUNCTION public.handle_new_user()
      SET search_path = public, auth, pg_temp;
    REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
  END IF;

  IF to_regprocedure('public.handle_user_email_change()') IS NOT NULL THEN
    ALTER FUNCTION public.handle_user_email_change()
      SET search_path = public, auth, pg_temp;
    REVOKE ALL ON FUNCTION public.handle_user_email_change() FROM PUBLIC;
  END IF;

  IF to_regprocedure('public.prevent_audit_log_modification()') IS NOT NULL THEN
    ALTER FUNCTION public.prevent_audit_log_modification()
      SET search_path = public, pg_temp;
    REVOKE ALL ON FUNCTION public.prevent_audit_log_modification() FROM PUBLIC;
  END IF;
END
$$;
