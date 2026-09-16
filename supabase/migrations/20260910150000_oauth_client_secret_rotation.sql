-- "Bible" item: OAuth client secret rotation (the sole live OAuth app,
-- 'Anansi', is oauth_apps' first and currently only row -- referred to as
-- C1 in planning docs).
--
-- Today public.oauth_apps.client_secret is stored in plaintext and
-- compared with a plain `!==` in supabase/functions/sso-token/index.ts.
-- RLS already restricts SELECT to the owning row's owner_id (2026-02-11),
-- so this is not a live read exposure, but it's still a stored-plaintext
-- secret with no rotation path: today, changing it is a hard cutover that
-- breaks the integrating app instantly, with no way to roll a compromised
-- secret without downtime and no audit trail of when it last rotated.
--
-- This migration adds the structure for safe rotation:
--   - only a SHA-256 hash of the current and (during a grace window) the
--     previous secret is stored, never plaintext, going forward;
--   - rotate_oauth_app_secret() generates a new secret, keeps the old one
--     valid for a grace window, and returns the new plaintext value
--     exactly once (never persisted or logged);
--   - verify_oauth_app_secret() centralizes the check so sso-token no
--     longer needs to see or compare the raw secret at all.
--
-- The grace window length is an operational default, not a product
-- decision (no user-facing behavior depends on the exact value) --
-- 24h gives an integrator time to pick up a rotated secret without a hard
-- outage. TODO product decision: whether rotation should ever be
-- self-service from a future developer-portal UI, and who is notified
-- when a rotation happens -- no such UI exists today, so this is
-- currently an operator-run RPC only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.oauth_apps
  ADD COLUMN IF NOT EXISTS client_secret_hash TEXT,
  ADD COLUMN IF NOT EXISTS client_secret_previous_hash TEXT,
  ADD COLUMN IF NOT EXISTS client_secret_previous_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_secret_rotated_at TIMESTAMPTZ;

-- Backfill the hash from whatever plaintext secret is live today, so
-- existing integrators (Anansi) keep working with the secret they already
-- have -- nothing changes for them.
UPDATE public.oauth_apps
SET client_secret_hash = encode(digest(client_secret, 'sha256'), 'hex')
WHERE client_secret_hash IS NULL AND client_secret IS NOT NULL;

-- Plaintext is no longer required after the backfill above; stop storing
-- it for any row that has been migrated to a hash.
ALTER TABLE public.oauth_apps ALTER COLUMN client_secret DROP NOT NULL;
UPDATE public.oauth_apps SET client_secret = NULL WHERE client_secret_hash IS NOT NULL;

-- SECURITY DEFINER so it can read/write client_secret_hash despite RLS
-- restricting oauth_apps SELECT/UPDATE to the row's own owner_id -- the
-- function itself re-checks ownership (or admin) before doing anything.
CREATE OR REPLACE FUNCTION public.rotate_oauth_app_secret(_app_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app RECORD;
  _new_secret TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _app FROM public.oauth_apps WHERE id = _app_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OAuth app not found';
  END IF;

  IF _app.owner_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to rotate this app''s secret';
  END IF;

  _new_secret := encode(gen_random_bytes(32), 'hex');

  UPDATE public.oauth_apps
  SET client_secret_previous_hash = client_secret_hash,
      client_secret_previous_expires_at = now() + interval '24 hours',
      client_secret_hash = encode(digest(_new_secret, 'sha256'), 'hex'),
      client_secret_rotated_at = now(),
      client_secret = NULL,
      updated_at = now()
  WHERE id = _app_id;

  -- Returned once, here, and nowhere else -- never logged, never re-readable.
  RETURN jsonb_build_object(
    'success', true,
    'client_secret', _new_secret,
    'previous_secret_valid_until', (now() + interval '24 hours')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_oauth_app_secret(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rotate_oauth_app_secret(UUID) TO authenticated;

-- Centralized verification: accepts the current secret, or the previous
-- one if still inside its grace window. Returns the app row (safe columns
-- only) on success, nothing on failure -- sso-token never sees a stored
-- hash or does its own comparison.
CREATE OR REPLACE FUNCTION public.verify_oauth_app_secret(_client_id TEXT, _secret TEXT)
RETURNS TABLE(app_id UUID, app_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app RECORD;
  _hash TEXT;
BEGIN
  SELECT id, name, is_active, client_secret_hash,
         client_secret_previous_hash, client_secret_previous_expires_at
  INTO _app
  FROM public.oauth_apps
  WHERE client_id = _client_id;

  IF NOT FOUND OR NOT _app.is_active THEN
    RETURN;
  END IF;

  _hash := encode(digest(_secret, 'sha256'), 'hex');

  IF _hash = _app.client_secret_hash THEN
    app_id := _app.id;
    app_name := _app.name;
    RETURN NEXT;
    RETURN;
  END IF;

  IF _app.client_secret_previous_hash IS NOT NULL
    AND _app.client_secret_previous_expires_at IS NOT NULL
    AND now() < _app.client_secret_previous_expires_at
    AND _hash = _app.client_secret_previous_hash
  THEN
    app_id := _app.id;
    app_name := _app.name;
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_oauth_app_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_oauth_app_secret(TEXT, TEXT) TO service_role;
