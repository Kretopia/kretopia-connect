-- Fixes SECURITY_RELEASE_GATE.md §C-bis finding #2 (WARN, opened
-- 2026-08-17, still open as of this session's audit): the
-- "Authenticated users can claim unclaimed roles" UPDATE policy on
-- icdb_project_roles (20260419162145) only constrains the `claimed_by`
-- column via WITH CHECK -- it says nothing about the other columns, so a
-- direct PostgREST PATCH can rewrite role_title/person_name/industry_code/
-- department/project_id on any unclaimed row while claiming it. This is
-- credit spoofing on the canonical, shared ICDB database: the rewritten
-- row is cited by every project page that references that role, not just
-- the claimer's own profile.
--
-- The claim_icdb_role() RPC (20260812071205) is already safe -- it only
-- ever sets claimed_by/is_claimed -- but the underlying RLS policy still
-- lets a client bypass the RPC entirely with a raw table PATCH. Confirmed
-- via read of the live policy definition (USING claimed_by IS NULL OR
-- claimed_by = auth.uid(), WITH CHECK claimed_by = auth.uid() -- no other
-- column constrained).
--
-- Fix: a BEFORE UPDATE trigger that blocks any change to the canonical
-- credit-identity columns unless the caller is admin, or the write is
-- going through claim_icdb_role() (flagged via a dedicated
-- transaction-local setting -- same pattern already used for the sibling
-- credits-table trigger via app.credit_verification_authorized).
-- Defense in depth: the RPC path is unaffected, the direct-PATCH path is
-- now rejected instead of silently succeeding.

CREATE OR REPLACE FUNCTION public.prevent_icdb_role_rewrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.icdb_claim_authorized', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role_title IS DISTINCT FROM OLD.role_title
    OR NEW.person_name IS DISTINCT FROM OLD.person_name
    OR NEW.industry_code IS DISTINCT FROM OLD.industry_code
    OR NEW.department IS DISTINCT FROM OLD.department
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
  THEN
    RAISE EXCEPTION 'Only claimed_by/is_claimed may be changed via a direct claim';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS icdb_project_roles_prevent_rewrite ON public.icdb_project_roles;
CREATE TRIGGER icdb_project_roles_prevent_rewrite
  BEFORE UPDATE ON public.icdb_project_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_icdb_role_rewrite();

-- Flag the trusted RPC path so it isn't caught by its own trigger.
-- Byte-for-byte identical to 20260812071205's definition, plus the one
-- set_config line before the icdb_project_roles UPDATE -- same
-- re-declare-with-one-line-added pattern used for approve_discovered_credit
-- / reject_discovered_credit in that same migration.
CREATE OR REPLACE FUNCTION public.claim_icdb_role(p_role_id uuid, p_thumbnail_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role RECORD;
  v_project RECORD;
  v_credit_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_role FROM public.icdb_project_roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_claimed THEN RAISE EXCEPTION 'Role already claimed'; END IF;

  SELECT * INTO v_project FROM public.icdb_projects WHERE id = v_role.project_id;

  PERFORM set_config('app.icdb_claim_authorized', 'true', true);

  UPDATE public.icdb_project_roles
  SET claimed_by = auth.uid(), is_claimed = true
  WHERE id = p_role_id;

  PERFORM set_config('app.credit_verification_authorized', 'true', true);

  INSERT INTO public.credits (
    user_id, project_name, role, year, platform, location,
    client_brand, project_type, verification_status, url, thumbnail_url
  ) VALUES (
    auth.uid(), v_project.title, v_role.role_title, v_project.year, v_project.platform,
    v_project.location, v_project.client_brand, v_project.type, 'pending', v_project.external_url,
    p_thumbnail_url
  )
  RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_icdb_role(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_icdb_role(uuid, text) TO authenticated;
