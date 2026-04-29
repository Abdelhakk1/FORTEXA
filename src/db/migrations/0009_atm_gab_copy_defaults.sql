-- ============================================================================
-- Fortexa ATM/GAB copy/default cleanup
-- Keeps the P0 onboarding/settings foundation focused on ATM/GAB operations.
-- ============================================================================

ALTER TABLE "public"."sites"
  ALTER COLUMN "site_type" SET DEFAULT 'atm_fleet';

UPDATE "public"."sites"
SET "site_type" = 'atm_fleet',
    "updated_at" = now()
WHERE "site_type" IN ('branch_network', 'edge');

UPDATE "public"."organizations"
SET "company_type" = 'atm_operator',
    "updated_at" = now()
WHERE "company_type" = 'branch_network';

UPDATE "public"."organization_settings"
SET "operating_context" =
      ("operating_context" - 'branchNetwork' - 'edgeInfrastructure')
      || jsonb_build_object(
        'atmGabFleet', COALESCE(("operating_context"->>'atmGabFleet')::boolean, true),
        'vendorManagedSystems', COALESCE(("operating_context"->>'vendorManagedSystems')::boolean, false)
      ),
    "updated_at" = now();

UPDATE "public"."report_definitions"
SET "description" = 'ATM/GAB exposure summary from real Fortexa data.',
    "updated_at" = now()
WHERE "name" = 'Executive Exposure Summary'
  AND (
    "description" ILIKE '%branch%'
    OR "description" ILIKE '%edge%'
  );
