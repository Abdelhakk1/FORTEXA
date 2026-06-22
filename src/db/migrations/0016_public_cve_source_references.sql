-- Keep CVE source references limited to public vulnerability intelligence.
-- Scanner-derived evidence stays tenant-scoped in scan_findings and asset detail views.

DELETE FROM "public"."cve_source_references"
WHERE "source_type" = 'internal';

ALTER TABLE "public"."cve_source_references"
  DROP CONSTRAINT IF EXISTS "chk_cve_source_references_public_source_type";

ALTER TABLE "public"."cve_source_references"
  ADD CONSTRAINT "chk_cve_source_references_public_source_type"
  CHECK ("source_type" <> 'internal');

NOTIFY pgrst, 'reload schema';
