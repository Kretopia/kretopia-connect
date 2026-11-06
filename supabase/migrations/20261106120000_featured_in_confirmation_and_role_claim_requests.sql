-- 1. "Featured In" (press_links) is shown publicly only after its owner confirms it.
-- 2. Claiming a Kretopia-database role becomes a REQUEST that a human decides; nothing reaches a Passport until it is approved.
--
-- PREPARED FOR REVIEW, NOT APPLIED. Production still runs the legacy backend, which cannot receive migrations from this repo.
--
-- Why (1): web discovery searched a NAME and saved every hit straight into press_links, where the public Passport showed it. A
-- page about another person with the same name became "Featured In" on the wrong Passport. After this migration:
--   * press_links.owner_confirmed_at is empty for every row: the public list starts at zero, and each member re-confirms what is
--     really theirs (their own Passport shows "Awaiting your confirmation" with Confirm and Remove). Nothing is deleted;
--   * a row reaches other people only when owner_confirmed_at is set (policy below), and service-role discovery inserts leave
--     it empty;
--   * the owner can set it on their own rows only (column UPDATE grant plus the existing owner policies).
--
-- Why (2): claim_icdb_role let any signed-in account take any free role, with no link to the name it was credited under. Now:
--   * request_icdb_role_claim records a private request (visible to its requester and admins only), creates no credit;
--   * decide_icdb_role_claim (admin) approves or rejects; approval claims the role once and creates the credit as
--     'unverified' (the owner's own claim, never verified), and closes other pending requests for that role;
--   * claim_icdb_role keeps its name and signature so an open old tab gets an answer, and now only files the request.
--
-- Preflight (read-only):
--   SELECT count(*) AS press_rows, count(*) FILTER (WHERE verification_status = 'auto_discovered') AS web_found FROM public.press_links;
--   SELECT count(*) FILTER (WHERE is_claimed) AS claimed_roles FROM public.icdb_project_roles;
--
-- Rollback: DROP POLICY on press_links, recreate "Users can view all press links" USING (true); drop the two RPCs and the table;
-- restore claim_icdb_role from 20260812071205_*.sql. No data is lost either way.

-- ---------------------------------------------------------------------------
-- 1. Featured In
-- ---------------------------------------------------------------------------
ALTER TABLE public.press_links ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz;

-- The earlier migrations granted UPDATE column by column, so a new column needs its own grant.
GRANT UPDATE (owner_confirmed_at) ON public.press_links TO authenticated;

DROP POLICY IF EXISTS "Users can view all press links" ON public.press_links;
DROP POLICY IF EXISTS "Press links: confirmed are public, own are visible to their owner" ON public.press_links;
CREATE POLICY "Press links: confirmed are public, own are visible to their owner"
  ON public.press_links FOR SELECT
  TO anon, authenticated
  USING (owner_confirmed_at IS NOT NULL OR user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Role claims as reviewed requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.icdb_role_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.icdb_project_roles(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);

-- One open request per person and role: a second tap cannot file a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS icdb_role_claim_one_pending
  ON public.icdb_role_claim_requests (role_id, requester_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS icdb_role_claim_requests_role ON public.icdb_role_claim_requests (role_id);

ALTER TABLE public.icdb_role_claim_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Requesters and admins read role claim requests" ON public.icdb_role_claim_requests;
CREATE POLICY "Requesters and admins read role claim requests"
  ON public.icdb_role_claim_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
-- No INSERT/UPDATE/DELETE policy and no write grant: the two functions below are the only way in.
REVOKE ALL ON public.icdb_role_claim_requests FROM public, anon, authenticated;
GRANT SELECT ON public.icdb_role_claim_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.request_icdb_role_claim(p_role_id uuid, p_thumbnail_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role RECORD;
  v_existing uuid;
  v_request uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_role FROM public.icdb_project_roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_claimed THEN RAISE EXCEPTION 'Role already claimed'; END IF;

  SELECT id INTO v_existing FROM public.icdb_role_claim_requests
  WHERE role_id = p_role_id AND requester_id = auth.uid() AND status = 'pending';
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'pending', true, 'request_id', v_existing, 'note', 'already_requested');
  END IF;

  -- A cap, so one account cannot flood the review queue.
  IF (SELECT count(*) FROM public.icdb_role_claim_requests WHERE requester_id = auth.uid() AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'Too many open claim requests';
  END IF;

  INSERT INTO public.icdb_role_claim_requests (role_id, requester_id, thumbnail_url)
  VALUES (p_role_id, auth.uid(), p_thumbnail_url)
  RETURNING id INTO v_request;

  RETURN jsonb_build_object('success', true, 'pending', true, 'request_id', v_request);
END;
$$;
REVOKE ALL ON FUNCTION public.request_icdb_role_claim(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_icdb_role_claim(uuid, text) TO authenticated;

-- Same name and signature as before so an old browser tab is answered, but it only files a request now.
CREATE OR REPLACE FUNCTION public.claim_icdb_role(p_role_id uuid, p_thumbnail_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.request_icdb_role_claim(p_role_id, p_thumbnail_url);
$$;
REVOKE ALL ON FUNCTION public.claim_icdb_role(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_icdb_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_icdb_role_claim(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_role RECORD;
  v_project RECORD;
  v_credit_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can decide a role claim';
  END IF;

  SELECT * INTO v_req FROM public.icdb_role_claim_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already ' || v_req.status);
  END IF;

  SELECT * INTO v_role FROM public.icdb_project_roles WHERE id = v_req.role_id FOR UPDATE;

  IF NOT p_approve OR v_role.is_claimed THEN
    UPDATE public.icdb_role_claim_requests
    SET status = 'rejected', decided_at = now(), decided_by = auth.uid(),
        note = COALESCE(p_note, CASE WHEN v_role.is_claimed THEN 'Role was already claimed' END)
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  SELECT * INTO v_project FROM public.icdb_projects WHERE id = v_role.project_id;

  UPDATE public.icdb_project_roles SET claimed_by = v_req.requester_id, is_claimed = true WHERE id = v_role.id;

  -- An approved claim is the member's own claim to the role: it is not verification of the work.
  INSERT INTO public.credits (
    user_id, project_name, role, year, platform, location,
    client_brand, project_type, verification_status, url, thumbnail_url
  ) VALUES (
    v_req.requester_id, v_project.title, v_role.role_title, v_project.year, v_project.platform,
    v_project.location, v_project.client_brand, v_project.type, 'unverified', v_project.external_url,
    v_req.thumbnail_url
  )
  RETURNING id INTO v_credit_id;

  UPDATE public.icdb_role_claim_requests
  SET status = 'approved', decided_at = now(), decided_by = auth.uid(), note = p_note
  WHERE id = p_request_id;

  UPDATE public.icdb_role_claim_requests
  SET status = 'rejected', decided_at = now(), decided_by = auth.uid(), note = 'Another claim for this role was approved'
  WHERE role_id = v_role.id AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'status', 'approved', 'credit_id', v_credit_id);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_icdb_role_claim(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_icdb_role_claim(uuid, boolean, text) TO authenticated;
