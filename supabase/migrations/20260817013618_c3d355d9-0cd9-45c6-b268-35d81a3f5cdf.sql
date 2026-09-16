CREATE OR REPLACE FUNCTION public.can_view_curated_stage(_stage_id uuid, _user_id uuid, _email text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.curated_stage_invites i
    WHERE i.stage_id = _stage_id
      AND (
        (_user_id IS NOT NULL AND i.user_id = _user_id)
        OR (_email IS NOT NULL AND lower(i.email) = lower(_email))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.curated_stage_rsvps r
    WHERE r.stage_id = _stage_id AND _user_id IS NOT NULL AND r.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.curated_stage_applications a
    WHERE a.stage_id = _stage_id AND _user_id IS NOT NULL AND a.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_curated_stage(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_curated_stage(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_curated_stage(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view scheduled or live stages" ON public.curated_stages;

CREATE POLICY "Public stages visible; private stages host or invitee only"
ON public.curated_stages
FOR SELECT
USING (
  host_user_id = auth.uid()
  OR (
    COALESCE(visibility, 'public') = 'public'
    AND status = ANY (ARRAY['scheduled', 'live', 'ended']::curated_stage_status[])
  )
  OR (
    auth.uid() IS NOT NULL
    AND public.can_view_curated_stage(id, auth.uid(), auth.jwt() ->> 'email')
  )
);

CREATE OR REPLACE FUNCTION public.get_curated_stage_by_invite(p_stage_id uuid, p_token text)
RETURNS TABLE (
  id uuid, host_user_id uuid, type curated_stage_type, title text, blurb text,
  description text, cover_url text, starts_at timestamptz, ends_at timestamptz,
  capacity integer, is_paid boolean, price_cents integer, currency text,
  status curated_stage_status, mode text, visibility text, vibe_tags text[],
  application_required boolean, application_prompt text, turn_seconds integer,
  rsvp_count integer, attended_count integer, recording_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.host_user_id, s.type, s.title, s.blurb, s.description, s.cover_url,
         s.starts_at, s.ends_at, s.capacity, s.is_paid, s.price_cents, s.currency,
         s.status, s.mode, s.visibility, s.vibe_tags, s.application_required,
         s.application_prompt, s.turn_seconds, s.rsvp_count, s.attended_count,
         s.recording_enabled
  FROM public.curated_stages s
  WHERE s.id = p_stage_id
    AND p_token IS NOT NULL
    AND s.invite_token IS NOT NULL
    AND s.invite_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_curated_stage_by_invite(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_stage_invite_token(p_stage_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.invite_token
  FROM public.curated_stages s
  WHERE s.id = p_stage_id AND s.host_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_stage_invite_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_stage_invite_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_stage_invite_token(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anonymous can update review request status" ON public.review_requests;

CREATE OR REPLACE FUNCTION public.complete_review_request(p_token text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN false;
  END IF;

  UPDATE public.review_requests
  SET status = 'completed', completed_at = now()
  WHERE share_token = p_token
    AND status = 'pending'
    AND expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_review_request(text) TO anon, authenticated, service_role;