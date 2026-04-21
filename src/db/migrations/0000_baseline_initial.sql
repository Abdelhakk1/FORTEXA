CREATE TYPE "public"."alert_status" AS ENUM('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('critical_risk', 'exposed_asset', 'overdue_remediation', 'new_critical_cve', 'policy_violation', 'sla_breach', 'import_error');--> statement-breakpoint
CREATE TYPE "public"."asset_criticality" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'inactive', 'maintenance', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('atm', 'gab', 'kiosk', 'server', 'network_device', 'workstation', 'other');--> statement-breakpoint
CREATE TYPE "public"."business_priority" AS ENUM('p1', 'p2', 'p3', 'p4', 'p5');--> statement-breakpoint
CREATE TYPE "public"."enrichment_source" AS ENUM('ai', 'manual', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."exploit_maturity" AS ENUM('active_in_wild', 'poc_available', 'theoretical', 'none');--> statement-breakpoint
CREATE TYPE "public"."exposure_level" AS ENUM('internet_facing', 'internal', 'isolated');--> statement-breakpoint
CREATE TYPE "public"."finding_match_method" AS ENUM('ip', 'hostname', 'manual');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('processing', 'completed', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."remediation_status" AS ENUM('open', 'assigned', 'in_progress', 'mitigated', 'closed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'csv', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('compliance', 'risk_posture', 'executive', 'remediation', 'custom');--> statement-breakpoint
CREATE TYPE "public"."scan_finding_status" AS ENUM('pending', 'matched', 'unmatched', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."scanner_source" AS ENUM('nessus', 'openvas', 'nmap', 'qualys', 'other');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."sla_status" AS ENUM('on_track', 'at_risk', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('nvd', 'vendor', 'cisa_kev', 'internal', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."vulnerability_status" AS ENUM('open', 'mitigated', 'closed', 'accepted');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "alert_type" NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "alert_status" DEFAULT 'new' NOT NULL,
	"related_asset_id" uuid,
	"related_cve_id" uuid,
	"related_asset_vulnerability_id" uuid,
	"related_scan_import_id" uuid,
	"related_remediation_task_id" uuid,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "chk_alert_has_relation" CHECK ("alerts"."related_asset_id" IS NOT NULL
        OR "alerts"."related_cve_id" IS NOT NULL
        OR "alerts"."related_asset_vulnerability_id" IS NOT NULL
        OR "alerts"."related_scan_import_id" IS NOT NULL
        OR "alerts"."related_remediation_task_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "asset_vulnerabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"cve_id" uuid NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "vulnerability_status" DEFAULT 'open' NOT NULL,
	"business_priority" "business_priority" DEFAULT 'p3' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"sla_due" timestamp with time zone,
	"sla_status" "sla_status" DEFAULT 'on_track' NOT NULL,
	"scoring_policy_id" uuid,
	"source_scan_import_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_asset_vulnerability" UNIQUE("asset_id","cve_id")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_code" text NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"model" text,
	"manufacturer" text,
	"branch" text,
	"region_id" uuid,
	"location" text,
	"ip_address" text,
	"os_version" text,
	"criticality" "asset_criticality" DEFAULT 'medium' NOT NULL,
	"exposure_level" "exposure_level" DEFAULT 'internal' NOT NULL,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"owner_id" uuid,
	"last_scan_date" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_code_unique" UNIQUE("asset_code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cve_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" uuid NOT NULL,
	"impact_analysis" text,
	"exploit_conditions" text,
	"primary_remediation" text,
	"confidence_score" integer,
	"context_reason" text,
	"ai_remediation_available" boolean DEFAULT false NOT NULL,
	"enrichment_source" "enrichment_source" DEFAULT 'ai' NOT NULL,
	"enriched_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cve_enrichments_cve_id_unique" UNIQUE("cve_id")
);
--> statement-breakpoint
CREATE TABLE "cve_recommended_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"command" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source" "enrichment_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cve_source_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"source_type" "source_type" DEFAULT 'other' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "severity" NOT NULL,
	"cvss_score" numeric(3, 1),
	"cvss_vector" text,
	"exploit_maturity" "exploit_maturity" DEFAULT 'none' NOT NULL,
	"patch_available" boolean DEFAULT false NOT NULL,
	"affected_products" jsonb DEFAULT '[]'::jsonb,
	"published_date" timestamp with time zone,
	"last_modified_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cves_cve_id_unique" UNIQUE("cve_id")
);
--> statement-breakpoint
CREATE TABLE "generated_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_definition_id" uuid NOT NULL,
	"generated_by" uuid,
	"storage_path" text NOT NULL,
	"file_format" "report_format" NOT NULL,
	"parameters" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"role_id" uuid,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_name_unique" UNIQUE("name"),
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "remediation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"asset_vulnerability_id" uuid,
	"cve_id" uuid,
	"assigned_to" uuid,
	"created_by" uuid NOT NULL,
	"due_date" timestamp with time zone,
	"sla_status" "sla_status" DEFAULT 'on_track' NOT NULL,
	"status" "remediation_status" DEFAULT 'open' NOT NULL,
	"priority" "severity" DEFAULT 'medium' NOT NULL,
	"business_priority" "business_priority" DEFAULT 'p3' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"change_request" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_remediation_has_target" CHECK ("remediation_tasks"."asset_vulnerability_id" IS NOT NULL OR "remediation_tasks"."cve_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "report_type" NOT NULL,
	"schedule" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scan_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_import_id" uuid NOT NULL,
	"finding_code" text,
	"title" text NOT NULL,
	"severity" "severity" NOT NULL,
	"host" text NOT NULL,
	"port" integer,
	"protocol" text,
	"raw_evidence" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_asset_id" uuid,
	"matched_cve_id" uuid,
	"match_confidence" integer,
	"match_method" "finding_match_method",
	"match_notes" text,
	"status" "scan_finding_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scanner_source" "scanner_source" NOT NULL,
	"import_date" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by" uuid,
	"file_name" text NOT NULL,
	"file_size" bigint,
	"storage_path" text,
	"status" "import_status" DEFAULT 'processing' NOT NULL,
	"assets_found" integer DEFAULT 0 NOT NULL,
	"findings_found" integer DEFAULT 0 NOT NULL,
	"cves_linked" integer DEFAULT 0 NOT NULL,
	"new_assets" integer DEFAULT 0 NOT NULL,
	"new_vulnerabilities" integer DEFAULT 0 NOT NULL,
	"closed_vulnerabilities" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"processing_time_ms" integer,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"severity_weight" integer DEFAULT 30 NOT NULL,
	"exploitability_weight" integer DEFAULT 25 NOT NULL,
	"asset_criticality_weight" integer DEFAULT 25 NOT NULL,
	"exposure_weight" integer DEFAULT 20 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_asset_id_assets_id_fk" FOREIGN KEY ("related_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_cve_id_cves_id_fk" FOREIGN KEY ("related_cve_id") REFERENCES "public"."cves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_asset_vulnerability_id_asset_vulnerabilities_id_fk" FOREIGN KEY ("related_asset_vulnerability_id") REFERENCES "public"."asset_vulnerabilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_scan_import_id_scan_imports_id_fk" FOREIGN KEY ("related_scan_import_id") REFERENCES "public"."scan_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_remediation_task_id_remediation_tasks_id_fk" FOREIGN KEY ("related_remediation_task_id") REFERENCES "public"."remediation_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_cve_id_cves_id_fk" FOREIGN KEY ("cve_id") REFERENCES "public"."cves"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_scoring_policy_id_scoring_policies_id_fk" FOREIGN KEY ("scoring_policy_id") REFERENCES "public"."scoring_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_source_scan_import_id_scan_imports_id_fk" FOREIGN KEY ("source_scan_import_id") REFERENCES "public"."scan_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cve_enrichments" ADD CONSTRAINT "cve_enrichments_cve_id_cves_id_fk" FOREIGN KEY ("cve_id") REFERENCES "public"."cves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cve_enrichments" ADD CONSTRAINT "cve_enrichments_enriched_by_profiles_id_fk" FOREIGN KEY ("enriched_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cve_recommended_controls" ADD CONSTRAINT "cve_recommended_controls_cve_id_cves_id_fk" FOREIGN KEY ("cve_id") REFERENCES "public"."cves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cve_source_references" ADD CONSTRAINT "cve_source_references_cve_id_cves_id_fk" FOREIGN KEY ("cve_id") REFERENCES "public"."cves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_report_definition_id_report_definitions_id_fk" FOREIGN KEY ("report_definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_asset_vulnerability_id_asset_vulnerabilities_id_fk" FOREIGN KEY ("asset_vulnerability_id") REFERENCES "public"."asset_vulnerabilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_cve_id_cves_id_fk" FOREIGN KEY ("cve_id") REFERENCES "public"."cves"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_findings" ADD CONSTRAINT "scan_findings_scan_import_id_scan_imports_id_fk" FOREIGN KEY ("scan_import_id") REFERENCES "public"."scan_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_findings" ADD CONSTRAINT "scan_findings_matched_asset_id_assets_id_fk" FOREIGN KEY ("matched_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_findings" ADD CONSTRAINT "scan_findings_matched_cve_id_cves_id_fk" FOREIGN KEY ("matched_cve_id") REFERENCES "public"."cves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_imports" ADD CONSTRAINT "scan_imports_imported_by_profiles_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_policies" ADD CONSTRAINT "scoring_policies_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alerts_status" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_alerts_severity" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_alerts_created" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_alerts_owner" ON "alerts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_asset" ON "alerts" USING btree ("related_asset_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_cve" ON "alerts" USING btree ("related_cve_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_av" ON "alerts" USING btree ("related_asset_vulnerability_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_scan" ON "alerts" USING btree ("related_scan_import_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_task" ON "alerts" USING btree ("related_remediation_task_id");--> statement-breakpoint
CREATE INDEX "idx_av_asset" ON "asset_vulnerabilities" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_av_cve" ON "asset_vulnerabilities" USING btree ("cve_id");--> statement-breakpoint
CREATE INDEX "idx_av_status" ON "asset_vulnerabilities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_av_risk" ON "asset_vulnerabilities" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "idx_av_priority" ON "asset_vulnerabilities" USING btree ("business_priority");--> statement-breakpoint
CREATE INDEX "idx_av_sla_status" ON "asset_vulnerabilities" USING btree ("sla_status");--> statement-breakpoint
CREATE INDEX "idx_av_sla_open" ON "asset_vulnerabilities" USING btree ("sla_due") WHERE "asset_vulnerabilities"."status" = 'open';--> statement-breakpoint
CREATE INDEX "idx_assets_region" ON "assets" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "idx_assets_type" ON "assets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_criticality" ON "assets" USING btree ("criticality");--> statement-breakpoint
CREATE INDEX "idx_assets_ip" ON "assets" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_assets_owner" ON "assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rem_status" ON "remediation_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rem_assigned" ON "remediation_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_rem_due" ON "remediation_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_rem_priority" ON "remediation_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_findings_import" ON "scan_findings" USING btree ("scan_import_id");--> statement-breakpoint
CREATE INDEX "idx_findings_status" ON "scan_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_findings_asset" ON "scan_findings" USING btree ("matched_asset_id");--> statement-breakpoint
CREATE INDEX "idx_findings_cve" ON "scan_findings" USING btree ("matched_cve_id");--> statement-breakpoint
CREATE INDEX "idx_findings_host" ON "scan_findings" USING btree ("host");--> statement-breakpoint
CREATE INDEX "idx_imports_status" ON "scan_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_imports_date" ON "scan_imports" USING btree ("import_date");--> statement-breakpoint
CREATE INDEX "idx_imports_user" ON "scan_imports" USING btree ("imported_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scoring_policy_active" ON "scoring_policies" USING btree ("is_active") WHERE "scoring_policies"."is_active" = true;