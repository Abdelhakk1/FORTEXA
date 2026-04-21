-- ============================================================================
-- Fortexa MVP Backend Foundation
-- Forward-only production patch for the existing hosted Supabase project.
-- ============================================================================

-- ─── 1. Harden audit trigger function search_path ───────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE and DELETE are prohibited';
  RETURN NULL;
END;
$$;

-- ─── 2. Missing FK indexes surfaced by advisors ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles (role_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_by ON public.alerts (resolved_by);
CREATE INDEX IF NOT EXISTS idx_asset_vulnerabilities_scoring_policy_id
  ON public.asset_vulnerabilities (scoring_policy_id);
CREATE INDEX IF NOT EXISTS idx_asset_vulnerabilities_source_scan_import_id
  ON public.asset_vulnerabilities (source_scan_import_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_asset_vulnerability_id
  ON public.remediation_tasks (asset_vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_created_by
  ON public.remediation_tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_cve_id
  ON public.remediation_tasks (cve_id);
CREATE INDEX IF NOT EXISTS idx_report_definitions_created_by
  ON public.report_definitions (created_by);
CREATE INDEX IF NOT EXISTS idx_generated_reports_report_definition_id
  ON public.generated_reports (report_definition_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_by
  ON public.generated_reports (generated_by);
CREATE INDEX IF NOT EXISTS idx_scan_findings_scan_import_status
  ON public.scan_findings (scan_import_id, status);

-- ─── 3. Storage buckets for backend-managed artifacts ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('fortexa-scan-imports', 'fortexa-scan-imports', false),
  ('fortexa-reports', 'fortexa-reports', false)
ON CONFLICT (id) DO NOTHING;
