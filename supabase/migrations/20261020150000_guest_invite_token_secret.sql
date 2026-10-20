-- M7 (docs/roadmap/schema-impact-report.md): get_or_create_guest_token_for_invite is callable by anonymous users
-- and trusted a project id plus a pending invitee's address, with no secret. Guest preview tokens also never expired.
-- 1. A pending invitation can carry the SHA-256 hash of a secret that travels in the emailed link; when it does,
--    the mint requires that secret. Invitations created before this change have no hash and keep the old
--    email-only check until they are accepted or withdrawn, so links already sent keep working.
-- 2. Tokens minted for an invitation expire after 14 days.
-- 3. When an invitation stops being pending (accepted, declined, withdrawn), the preview tokens minted for that
--    invitation are revoked. Guest links the owner created by hand (other labels) are not touched.
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: DROP TRIGGER trg_revoke_invite_preview_tokens ON public.project_collaborators;
--           DROP FUNCTION public.revoke_invite_preview_tokens();
--           restore the previous 2-argument function (migration 20260505133625) after dropping the 3-argument one;
--           the column can stay (ALTER TABLE public.project_collaborators DROP COLUMN invite_secret_hash).

ALTER TABLE public.project_collaborators ADD COLUMN IF NOT EXISTS invite_secret_hash text;

DROP FUNCTION IF EXISTS public.get_or_create_guest_token_for_invite(uuid, text);

CREATE OR REPLACE FUNCTION public.get_or_create_guest_token_for_invite(_project_id uuid, _email text, _secret text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite_owner uuid;
  v_hash text;
  v_token text;
  v_email text := lower(trim(_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- Only mint a token if there's an actual pending invite for this email on this project
  SELECT p.created_by, pc.invite_secret_hash INTO v_invite_owner, v_hash
  FROM public.project_collaborators pc
  JOIN public.projects p ON p.id = pc.project_id
  WHERE pc.project_id = _project_id
    AND lower(pc.email) = v_email
    AND pc.status = 'pending'
  LIMIT 1;

  IF v_invite_owner IS NULL THEN
    RETURN NULL;
  END IF;

  -- An invitation sent with a secret in its link needs that secret. Older invitations have none.
  IF v_hash IS NOT NULL AND (
       _secret IS NULL OR encode(extensions.digest(_secret, 'sha256'), 'hex') <> v_hash
     ) THEN
    RETURN NULL;
  END IF;

  -- Reuse an existing live token for this email if one exists
  SELECT token INTO v_token
  FROM public.guest_studio_tokens
  WHERE project_id = _project_id
    AND lower(guest_email) = v_email
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- Mint a new one
  INSERT INTO public.guest_studio_tokens (project_id, created_by, guest_email, label, expires_at)
  VALUES (_project_id, v_invite_owner, v_email, 'Email invite preview', now() + interval '14 days')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_token_for_invite(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.revoke_invite_preview_tokens() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.email IS NULL OR OLD.status IS DISTINCT FROM 'pending' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM 'pending' THEN
      RETURN NULL;
    END IF;
  END IF;
  UPDATE public.guest_studio_tokens
  SET revoked_at = now()
  WHERE project_id = OLD.project_id
    AND lower(guest_email) = lower(OLD.email)
    AND revoked_at IS NULL
    AND (label = 'Email invite preview' OR label LIKE 'Invite for %');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_invite_preview_tokens ON public.project_collaborators;
CREATE TRIGGER trg_revoke_invite_preview_tokens
  AFTER UPDATE OF status OR DELETE ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.revoke_invite_preview_tokens();
