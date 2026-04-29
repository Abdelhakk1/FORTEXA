-- ============================================================================
-- Fortexa team invites and tenant security foundation
-- Forward-only, defensive migration for the single-organization MVP.
-- Safe to paste into Supabase SQL Editor.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS "public"."organization_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "invited_by" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
  "accepted_by" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
  "email_message_id" text,
  "expires_at" timestamp with time zone NOT NULL,
  "last_sent_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "token_hash" text;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending';
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "invited_by" uuid;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "accepted_by" uuid;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "email_message_id" text;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "last_sent_at" timestamp with time zone;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE "public"."organization_invites" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "organization_id" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'email'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "email" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'role'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "role" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "token_hash" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'status'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "status" SET DEFAULT 'pending';
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "status" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "expires_at" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "created_at" SET DEFAULT now();
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "created_at" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "updated_at" SET DEFAULT now();
    ALTER TABLE "public"."organization_invites" ALTER COLUMN "updated_at" SET NOT NULL;
  END IF;
END
$$;

DO $$
DECLARE
  fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.organization_invites'::regclass
      AND contype = 'f'
      AND conname = 'organization_invites_organization_id_organizations_id_fk'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE "public"."organization_invites"
      ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.organization_invites'::regclass
      AND contype = 'f'
      AND conname = 'organization_invites_invited_by_profiles_id_fk'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE "public"."organization_invites"
      ADD CONSTRAINT "organization_invites_invited_by_profiles_id_fk"
      FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.organization_invites'::regclass
      AND contype = 'f'
      AND conname = 'organization_invites_accepted_by_profiles_id_fk'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE "public"."organization_invites"
      ADD CONSTRAINT "organization_invites_accepted_by_profiles_id_fk"
      FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE set null;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_invites_token_hash"
  ON "public"."organization_invites" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_org_invites_org_status"
  ON "public"."organization_invites" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_org_invites_email"
  ON "public"."organization_invites" ("email");
CREATE INDEX IF NOT EXISTS "idx_org_invites_expires"
  ON "public"."organization_invites" ("expires_at");

DO $$
DECLARE
  duplicate_count integer := 0;
BEGIN
  SELECT count(*)::int INTO duplicate_count
  FROM (
    SELECT organization_id, lower(email)
    FROM public.organization_invites
    WHERE status = 'pending'
    GROUP BY organization_id, lower(email)
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_invites_pending_email"
      ON "public"."organization_invites" ("organization_id", lower("email"))
      WHERE "status" = 'pending';
  ELSE
    RAISE NOTICE 'Skipping uq_org_invites_pending_email: duplicate pending invites already exist.';
  END IF;
END
$$;

DO $$
DECLARE
  duplicate_count integer := 0;
BEGIN
  SELECT count(*)::int INTO duplicate_count
  FROM (
    SELECT profile_id
    FROM public.organization_members
    WHERE status = 'active'
    GROUP BY profile_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_members_one_active_org_per_profile"
      ON "public"."organization_members" ("profile_id")
      WHERE "status" = 'active';
  ELSE
    RAISE NOTICE 'Skipping uq_org_members_one_active_org_per_profile: profiles with multiple active organizations already exist.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.fortexa_is_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org_id
      AND om.profile_id = (select auth.uid())
      AND om.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.fortexa_can_manage_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org_id
      AND om.profile_id = (select auth.uid())
      AND om.status = 'active'
      AND om.role IN ('owner', 'administrator', 'security_manager')
  );
$$;

CREATE OR REPLACE FUNCTION private.fortexa_shares_org_with_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members mine
    JOIN public.organization_members theirs
      ON theirs.organization_id = mine.organization_id
     AND theirs.status = 'active'
    WHERE mine.profile_id = (select auth.uid())
      AND mine.status = 'active'
      AND theirs.profile_id = target_profile_id
  );
$$;

REVOKE ALL ON FUNCTION private.fortexa_is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.fortexa_can_manage_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.fortexa_shares_org_with_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fortexa_is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.fortexa_can_manage_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.fortexa_shares_org_with_profile(uuid) TO authenticated, service_role;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_invites" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_same_org" ON "public"."profiles";
CREATE POLICY "profiles_select_same_org"
  ON "public"."profiles"
  FOR SELECT
  TO authenticated
  USING (
    "id" = (select auth.uid())
    OR private.fortexa_shares_org_with_profile("id")
  );

DROP POLICY IF EXISTS "profiles_update_self" ON "public"."profiles";
CREATE POLICY "profiles_update_self"
  ON "public"."profiles"
  FOR UPDATE
  TO authenticated
  USING ("id" = (select auth.uid()))
  WITH CHECK ("id" = (select auth.uid()));

DROP POLICY IF EXISTS "roles_select_authenticated" ON "public"."roles";
CREATE POLICY "roles_select_authenticated"
  ON "public"."roles"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "organizations_select_member" ON "public"."organizations";
CREATE POLICY "organizations_select_member"
  ON "public"."organizations"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_is_org_member("id"));

DROP POLICY IF EXISTS "organizations_update_manager" ON "public"."organizations";
CREATE POLICY "organizations_update_manager"
  ON "public"."organizations"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_can_manage_org("id"))
  WITH CHECK (private.fortexa_can_manage_org("id"));

DROP POLICY IF EXISTS "organization_members_select_member" ON "public"."organization_members";
CREATE POLICY "organization_members_select_member"
  ON "public"."organization_members"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_is_org_member("organization_id"));

DROP POLICY IF EXISTS "organization_members_insert_manager" ON "public"."organization_members";
CREATE POLICY "organization_members_insert_manager"
  ON "public"."organization_members"
  FOR INSERT
  TO authenticated
  WITH CHECK (private.fortexa_can_manage_org("organization_id"));

DROP POLICY IF EXISTS "organization_members_update_manager" ON "public"."organization_members";
CREATE POLICY "organization_members_update_manager"
  ON "public"."organization_members"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_can_manage_org("organization_id"))
  WITH CHECK (private.fortexa_can_manage_org("organization_id"));

DROP POLICY IF EXISTS "organization_invites_select_manager" ON "public"."organization_invites";
CREATE POLICY "organization_invites_select_manager"
  ON "public"."organization_invites"
  FOR SELECT
  TO authenticated
  USING (private.fortexa_can_manage_org("organization_id"));

DROP POLICY IF EXISTS "organization_invites_insert_manager" ON "public"."organization_invites";
CREATE POLICY "organization_invites_insert_manager"
  ON "public"."organization_invites"
  FOR INSERT
  TO authenticated
  WITH CHECK (private.fortexa_can_manage_org("organization_id"));

DROP POLICY IF EXISTS "organization_invites_update_manager" ON "public"."organization_invites";
CREATE POLICY "organization_invites_update_manager"
  ON "public"."organization_invites"
  FOR UPDATE
  TO authenticated
  USING (private.fortexa_can_manage_org("organization_id"))
  WITH CHECK (private.fortexa_can_manage_org("organization_id"));

DO $$
DECLARE
  rls_table_name text;
  table_names text[] := ARRAY[
    'organization_settings',
    'sites',
    'assets',
    'scan_imports',
    'scan_findings',
    'asset_vulnerabilities',
    'asset_vulnerability_events',
    'asset_vulnerability_enrichments',
    'remediation_tasks',
    'alerts',
    'report_definitions',
    'generated_reports'
  ];
BEGIN
  FOREACH rls_table_name IN ARRAY table_names LOOP
    IF to_regclass(format('public.%I', rls_table_name)) IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = rls_table_name
          AND column_name = 'organization_id'
      )
    THEN
      RAISE NOTICE 'Skipping RLS policies for %.organization_id: table or column is not present.', rls_table_name;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rls_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rls_table_name || '_select_member', rls_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.fortexa_is_org_member(organization_id))',
      rls_table_name || '_select_member',
      rls_table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rls_table_name || '_insert_member', rls_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.fortexa_is_org_member(organization_id))',
      rls_table_name || '_insert_member',
      rls_table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rls_table_name || '_update_member', rls_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.fortexa_is_org_member(organization_id)) WITH CHECK (private.fortexa_is_org_member(organization_id))',
      rls_table_name || '_update_member',
      rls_table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rls_table_name || '_delete_member', rls_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.fortexa_is_org_member(organization_id))',
      rls_table_name || '_delete_member',
      rls_table_name
    );
  END LOOP;
END
$$;

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_member" ON "public"."audit_logs";
CREATE POLICY "audit_logs_select_member"
  ON "public"."audit_logs"
  FOR SELECT
  TO authenticated
  USING (
    "organization_id" IS NOT NULL
    AND private.fortexa_is_org_member("organization_id")
  );

DROP POLICY IF EXISTS "audit_logs_insert_member" ON "public"."audit_logs";
CREATE POLICY "audit_logs_insert_member"
  ON "public"."audit_logs"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "organization_id" IS NOT NULL
    AND private.fortexa_is_org_member("organization_id")
  );

NOTIFY pgrst, 'reload schema';
