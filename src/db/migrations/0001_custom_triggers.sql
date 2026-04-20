-- ============================================================================
-- Fortexa Custom Migration: Triggers & Constraints
-- Apply AFTER the Drizzle-generated migration.
-- ============================================================================

-- ─── 1. Supabase Auth → Profiles auto-creation trigger ──────────────────────
-- Uses UPSERT (ON CONFLICT) so the trigger can heal drift if a partial
-- profile row already exists, instead of failing hard on duplicate.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN NEW;
END;
$$;

-- Drop if exists to make this idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. Audit Logs: Append-only enforcement ─────────────────────────────────
-- Blocks UPDATE and DELETE on audit_logs at the database level.
-- This is the real guarantee, not just a comment.
--
-- NOTE: This will also block admin cleanup scripts intentionally.
-- For retention/archive operations, the procedure is:
--   1. Temporarily disable the trigger: ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable;
--   2. Run the cleanup/archive operation
--   3. Re-enable: ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable;
-- This must be done by a superuser and should be logged externally.

CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE and DELETE are prohibited';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();


-- ─── 3. Supabase Auth email sync trigger ─────────────────────────────────────
-- Keeps profiles.email in sync when a user changes their email in Supabase Auth.
-- Uses UPSERT to recover from a missing profile row instead of silently failing.
--
-- The trigger is narrowed to fire only on email column changes (AFTER UPDATE OF email)
-- with a WHEN clause, so it doesn't fire on unrelated auth.users updates.

CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_change();
