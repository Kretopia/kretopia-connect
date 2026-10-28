-- ============================================================================
-- External discovery -> claim loop. DRAFT: NOT APPLIED to production.
--
-- Purely additive: new tables, one view and service-role-only functions. Nothing that exists is altered, so applying it
-- before the edge functions and the frontend is safe (nothing reads these tables until they ship). Apply order, each
-- step needing its own approval: this file, then the edge functions, then the frontend. Rollback: the DROP block at the
-- bottom (commented), which loses only what was imported since.
--
-- What it gives (see docs/release/EXTERNAL_DISCOVERY.md):
--   * external_listings: a listing found OUTSIDE Kretopia (gig, event, talent) with its provenance, a review state and
--     a stable identity. A global unique index on the identity key makes two imports of one posting ONE row, atomically.
--   * claim tokens (hashed, expiring, single-use, bound to one listing) and claims. Redeeming a token opens a claim; it
--     never grants ownership. Ownership comes only from a verified claim (domain control or a documented admin review).
--   * a spending ledger with atomic reservation across scopes (global ceiling, source, user), a kill switch and a
--     per-source enable that refuses an unknown cost.
-- Clients get NO table access: the edge functions (service role) are the only writer and reader, and the public sees
-- only the public_external_listings view (published or claimed, public, not expired, not flagged).
-- ============================================================================

-- ── settings and sources ────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discovery_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,                 -- the kill switch: nothing automated runs while false
  daily_ceiling_cents integer NOT NULL DEFAULT 0 CHECK (daily_ceiling_cents >= 0),
  per_user_daily_cents integer NOT NULL DEFAULT 0 CHECK (per_user_daily_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.discovery_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.discovery_sources (
  id text PRIMARY KEY,                                    -- the adapter id (remoteok, jobicy, ...)
  enabled boolean NOT NULL DEFAULT false,
  cost_per_call_cents integer CHECK (cost_per_call_cents IS NULL OR cost_per_call_cents >= 0), -- NULL = unknown
  daily_budget_cents integer NOT NULL DEFAULT 0 CHECK (daily_budget_cents >= 0),
  max_fetches_per_run integer NOT NULL DEFAULT 1 CHECK (max_fetches_per_run BETWEEN 0 AND 20),
  last_run_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,        -- three failures in a row switch the source off (dead letter)
  last_error text,
  dead_lettered_at timestamptz,
  run_lock_until timestamptz,                             -- overlap lock: one run per source at a time
  CONSTRAINT discovery_sources_enable_needs_known_cost CHECK (NOT enabled OR cost_per_call_cents IS NOT NULL)
);

-- ── listings ─────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.external_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('gig', 'event', 'talent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'claimed', 'expired', 'removed', 'rejected')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'review', 'public')),
  created_by uuid,                                        -- the importer; no FK so deleting a user never deletes the record
  owner_user_id uuid,                                     -- set only by a VERIFIED claim
  source_type text NOT NULL CHECK (source_type IN ('feed', 'url', 'text', 'screenshot', 'manual')),
  source_provider text,
  source_id text,
  source_url text,
  canonical_url text,
  identity_key text,                                      -- provider:id or url:<canonical>; NULL when there is no source
  original_publisher text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  location text,
  remote_scope text CHECK (remote_scope IS NULL OR remote_scope IN ('remote', 'hybrid', 'onsite')),
  source_published_at timestamptz,                        -- as stated by the source; never the crawl time
  deadline_at timestamptz,
  deadline_tz text,
  budget jsonb,
  apply_url text,
  excerpt text CHECK (excerpt IS NULL OR char_length(excerpt) <= 600),   -- the only source text we keep
  starts_at timestamptz,
  ends_at timestamptz,
  roles text[] NOT NULL DEFAULT '{}',
  description_full text CHECK (description_full IS NULL OR char_length(description_full) <= 20000), -- owner-supplied, after a verified claim
  applications_enabled boolean NOT NULL DEFAULT false,    -- off until an admin enables it for a verified owner
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'source_checked', 'owner_verified')),
  flagged_instructions boolean NOT NULL DEFAULT false,
  possible_duplicates jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- a screenshot with no corroborating source can only ever be a private review draft
  CONSTRAINT external_listings_screenshot_stays_private CHECK (source_type <> 'screenshot' OR identity_key IS NOT NULL OR visibility = 'private'),
  CONSTRAINT external_listings_public_needs_status CHECK (visibility <> 'public' OR status IN ('published', 'claimed'))
);

-- ONE listing per posting, whatever the number of concurrent imports.
CREATE UNIQUE INDEX IF NOT EXISTS external_listings_identity_uq
  ON public.external_listings (identity_key)
  WHERE identity_key IS NOT NULL AND status NOT IN ('rejected', 'removed');
CREATE INDEX IF NOT EXISTS external_listings_status_idx ON public.external_listings (status, visibility, kind);

-- ── claims ───────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.external_listing_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.external_listings(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256 of the token; the token is never stored
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.external_listing_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.external_listings(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL,
  token_id uuid REFERENCES public.external_listing_claim_tokens(id),
  method text CHECK (method IS NULL OR method IN ('source_domain', 'admin_review')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'disputed', 'withdrawn')),
  domain text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,            -- what proved it (a domain and a time); never a secret
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS external_listing_one_verified_claim ON public.external_listing_claims (listing_id) WHERE status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS external_listing_one_open_claim_per_user ON public.external_listing_claims (listing_id, claimant_user_id) WHERE status IN ('pending', 'disputed');

CREATE TABLE IF NOT EXISTS public.external_listing_events (   -- append-only audit trail
  id bigserial PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.external_listings(id) ON DELETE CASCADE,
  actor uuid,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

-- ── spending ledger ────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discovery_spend_counters (
  day date NOT NULL,
  scope text NOT NULL,                                    -- global | source:<id> | user:<uuid>
  spent_cents integer NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  PRIMARY KEY (day, scope)
);

CREATE TABLE IF NOT EXISTS public.discovery_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,                           -- idempotent: the same job never reserves twice
  day date NOT NULL,
  scopes text[] NOT NULL,
  reserved_cents integer NOT NULL CHECK (reserved_cents >= 0),
  settled_cents integer CHECK (settled_cents IS NULL OR settled_cents >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

-- ── access: no client touches these tables; the public sees one view ────────────────────────────────────────────────

ALTER TABLE public.discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_listing_claim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_listing_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_listing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_spend_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_spend_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.discovery_settings, public.discovery_sources, public.external_listings, public.external_listing_claim_tokens,
  public.external_listing_claims, public.external_listing_events, public.discovery_spend_counters, public.discovery_spend_ledger
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.discovery_settings, public.discovery_sources, public.external_listings, public.external_listing_claim_tokens,
  public.external_listing_claims, public.external_listing_events, public.discovery_spend_counters, public.discovery_spend_ledger
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.external_listing_events_id_seq TO service_role;

-- What the public may read: only published or claimed, public, unexpired, unflagged listings, with no internal columns.
CREATE OR REPLACE VIEW public.public_external_listings AS
  SELECT id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, deadline_tz,
         budget, apply_url, excerpt, description_full, starts_at, ends_at, roles, verification_status, last_checked_at,
         source_provider, source_url, applications_enabled, (status = 'claimed') AS claimed
  FROM public.external_listings
  WHERE status IN ('published', 'claimed') AND visibility = 'public' AND NOT flagged_instructions
    AND (deadline_at IS NULL OR deadline_at > now());
REVOKE ALL ON public.public_external_listings FROM PUBLIC;
GRANT SELECT ON public.public_external_listings TO anon, authenticated, service_role;

-- ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.external_is_admin(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT p_user IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role::text = 'admin') $$;

CREATE OR REPLACE FUNCTION public.external_log(p_listing uuid, p_actor uuid, p_event text, p_detail jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ INSERT INTO public.external_listing_events (listing_id, actor, event, detail) VALUES (p_listing, p_actor, p_event, p_detail) $$;

-- ── import: atomic, one listing per identity ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.import_external_listing(p_actor uuid, p_row jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_existing record;
  v_key text := NULLIF(p_row->>'identity_key', '');
BEGIN
  INSERT INTO public.external_listings (
    kind, status, visibility, created_by, source_type, source_provider, source_id, source_url, canonical_url, identity_key,
    original_publisher, title, location, remote_scope, source_published_at, deadline_at, deadline_tz, budget, apply_url, excerpt,
    starts_at, ends_at, roles, flagged_instructions, possible_duplicates, extraction_issues, provenance, retrieved_at, last_checked_at
  ) VALUES (
    p_row->>'kind', 'draft', 'private', p_actor, p_row->>'source_type', p_row->>'source_provider', p_row->>'source_id',
    p_row->>'source_url', p_row->>'canonical_url', v_key,
    p_row->>'original_publisher', p_row->>'title', p_row->>'location', p_row->>'remote_scope',
    NULLIF(p_row->>'source_published_at', '')::timestamptz, NULLIF(p_row->>'deadline_at', '')::timestamptz, p_row->>'deadline_tz',
    p_row->'budget', p_row->>'apply_url', p_row->>'excerpt',
    NULLIF(p_row->>'starts_at', '')::timestamptz, NULLIF(p_row->>'ends_at', '')::timestamptz,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_row->'roles', '[]'::jsonb))), '{}'),
    COALESCE((p_row->>'flagged_instructions')::boolean, false), COALESCE(p_row->'possible_duplicates', '[]'::jsonb),
    COALESCE(p_row->'extraction_issues', '[]'::jsonb), COALESCE(p_row->'provenance', '{}'::jsonb),
    COALESCE(NULLIF(p_row->>'retrieved_at', '')::timestamptz, now()), now()
  )
  ON CONFLICT (identity_key) WHERE identity_key IS NOT NULL AND status NOT IN ('rejected', 'removed') DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    PERFORM public.external_log(v_id, p_actor, 'imported', jsonb_build_object('source_type', p_row->>'source_type', 'identity_key', v_key));
    RETURN jsonb_build_object('created', true, 'listing_id', v_id);
  END IF;

  -- Already known: record that it was seen again. The publisher's content is never overwritten by a re-import.
  UPDATE public.external_listings SET last_checked_at = now()
   WHERE identity_key = v_key AND status NOT IN ('rejected', 'removed')
  RETURNING id, status, created_by INTO v_existing;
  -- A private draft of another person is not disclosed: only its existence ("already known") is.
  RETURN jsonb_build_object(
    'created', false,
    'listing_id', CASE WHEN v_existing.status IN ('published', 'claimed') OR v_existing.created_by = p_actor THEN v_existing.id ELSE NULL END,
    'reason', 'already_known'
  );
END;
$$;

-- ── review (curators only) ───────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.review_external_listing(p_listing uuid, p_actor uuid, p_action text, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  l public.external_listings%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.external_listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  IF p_action = 'send_to_review' THEN
    IF l.created_by IS DISTINCT FROM p_actor AND NOT public.external_is_admin(p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
    IF l.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_a_draft'); END IF;
    UPDATE public.external_listings SET status = 'in_review', visibility = 'review', updated_at = now() WHERE id = p_listing;
  ELSE
    IF NOT public.external_is_admin(p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
    IF p_action = 'approve' THEN
      IF l.status NOT IN ('draft', 'in_review') THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_reviewable'); END IF;
      IF l.identity_key IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'needs_corroborating_source'); END IF;
      IF l.flagged_instructions THEN RETURN jsonb_build_object('ok', false, 'reason', 'flagged_instructions'); END IF;
      IF l.apply_url IS NULL OR l.original_publisher IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_publisher_or_destination'); END IF;
      UPDATE public.external_listings
         SET status = 'published', visibility = 'public', reviewed_by = p_actor, reviewed_at = now(), updated_at = now(),
             verification_status = CASE WHEN source_type IN ('feed', 'url') THEN 'source_checked' ELSE verification_status END
       WHERE id = p_listing;
    ELSIF p_action = 'reject' THEN
      UPDATE public.external_listings SET status = 'rejected', visibility = 'private', reviewed_by = p_actor, reviewed_at = now(), updated_at = now() WHERE id = p_listing;
    ELSIF p_action IN ('remove', 'expire') THEN
      UPDATE public.external_listings SET status = CASE WHEN p_action = 'expire' THEN 'expired' ELSE 'removed' END, visibility = 'private', updated_at = now() WHERE id = p_listing;
      UPDATE public.external_listing_claim_tokens SET revoked_at = now() WHERE listing_id = p_listing AND used_at IS NULL AND revoked_at IS NULL;
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'unknown_action');
    END IF;
  END IF;
  PERFORM public.external_log(p_listing, p_actor, 'review_' || p_action, jsonb_build_object('note', left(COALESCE(p_note, ''), 500)));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── claim tokens: an invitation to verify ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.register_claim_token(p_listing uuid, p_actor uuid, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  l public.external_listings%ROWTYPE;
  v_active integer;
BEGIN
  IF NOT public.external_is_admin(p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  SELECT * INTO l FROM public.external_listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  -- Only an APPROVED, still unclaimed listing can be offered for claiming.
  IF l.status <> 'published' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_published_or_already_claimed'); END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + interval '30 days' THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_expiry'); END IF;
  SELECT count(*) INTO v_active FROM public.external_listing_claim_tokens
   WHERE listing_id = p_listing AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now();
  IF v_active >= 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_active_links'); END IF;
  INSERT INTO public.external_listing_claim_tokens (listing_id, token_hash, created_by, expires_at) VALUES (p_listing, p_token_hash, p_actor, p_expires_at);
  PERFORM public.external_log(p_listing, p_actor, 'claim_link_created', jsonb_build_object('expires_at', p_expires_at));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Atomic redemption. The token is bound to ONE listing and works ONCE. Redeeming opens a PENDING claim for the signed-in
-- caller: it proves nothing about ownership. The reason for a refusal is deliberately coarse.
CREATE OR REPLACE FUNCTION public.redeem_claim_token(p_token_hash text, p_listing uuid, p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_token_id uuid;
  v_claim_id uuid;
  l public.external_listings%ROWTYPE;
BEGIN
  IF p_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'sign_in_required'); END IF;
  SELECT * INTO l FROM public.external_listings WHERE id = p_listing;
  IF NOT FOUND OR l.status <> 'published' THEN RETURN jsonb_build_object('ok', false, 'reason', 'unavailable'); END IF;

  UPDATE public.external_listing_claim_tokens
     SET used_at = now(), used_by = p_user
   WHERE token_hash = p_token_hash AND listing_id = p_listing
     AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING id INTO v_token_id;
  IF v_token_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_used'); END IF;

  INSERT INTO public.external_listing_claims (listing_id, claimant_user_id, token_id) VALUES (p_listing, p_user, v_token_id)
  ON CONFLICT (listing_id, claimant_user_id) WHERE status IN ('pending', 'disputed') DO UPDATE SET token_id = EXCLUDED.token_id
  RETURNING id INTO v_claim_id;
  PERFORM public.external_log(p_listing, p_user, 'claim_opened', jsonb_build_object('claim_id', v_claim_id));
  RETURN jsonb_build_object('ok', true, 'claim_id', v_claim_id);
END;
$$;

-- Records the verification of a claim and makes the claimant the owner. Called by the edge function ONLY after it has
-- verified control (a domain proof fetched through the bounded gateway) or an admin decided. Atomic: one verified
-- claim per listing, enforced by a unique index, so two simultaneous verifications cannot both win.
CREATE OR REPLACE FUNCTION public.verify_external_claim(p_claim uuid, p_claimant uuid, p_method text, p_domain text, p_decided_by uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  c public.external_listing_claims%ROWTYPE;
BEGIN
  IF p_method NOT IN ('source_domain', 'admin_review') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_method'); END IF;
  IF p_method = 'admin_review' AND NOT public.external_is_admin(p_decided_by) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  SELECT * INTO c FROM public.external_listing_claims WHERE id = p_claim FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF c.claimant_user_id <> p_claimant AND p_method = 'source_domain' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_your_claim'); END IF;
  IF c.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
  BEGIN
    UPDATE public.external_listing_claims
       SET status = 'verified', method = p_method, domain = p_domain, decided_at = now(), decided_by = p_decided_by,
           evidence = jsonb_build_object('method', p_method, 'domain', p_domain, 'verified_at', now())
     WHERE id = p_claim;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END;
  UPDATE public.external_listings
     SET status = 'claimed', owner_user_id = c.claimant_user_id, verification_status = 'owner_verified', updated_at = now()
   WHERE id = c.listing_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'listing is no longer claimable'; END IF;
  UPDATE public.external_listing_claim_tokens SET revoked_at = now() WHERE listing_id = c.listing_id AND used_at IS NULL AND revoked_at IS NULL;
  PERFORM public.external_log(c.listing_id, p_decided_by, 'claim_verified', jsonb_build_object('claim_id', p_claim, 'method', p_method, 'domain', p_domain));
  RETURN jsonb_build_object('ok', true, 'listing_id', c.listing_id);
END;
$$;

-- A curator turns a claim down. The claimant stays a visitor: nothing about the listing changes.
CREATE OR REPLACE FUNCTION public.reject_external_claim(p_claim uuid, p_admin uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_listing uuid;
BEGIN
  IF NOT public.external_is_admin(p_admin) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  UPDATE public.external_listing_claims SET status = 'rejected', decided_at = now(), decided_by = p_admin
   WHERE id = p_claim AND status IN ('pending', 'disputed') RETURNING listing_id INTO v_listing;
  IF v_listing IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
  PERFORM public.external_log(v_listing, p_admin, 'claim_rejected', jsonb_build_object('claim_id', p_claim));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- An owner manages ONLY their own listing, ONLY these fields. Provenance (source, retrieval, identity) stays untouched.
CREATE OR REPLACE FUNCTION public.owner_update_external_listing(p_listing uuid, p_owner uuid, p_edits jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  l public.external_listings%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.external_listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND OR l.owner_user_id IS DISTINCT FROM p_owner OR l.status <> 'claimed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  UPDATE public.external_listings SET
    description_full = CASE WHEN p_edits ? 'description_full' THEN left(p_edits->>'description_full', 20000) ELSE description_full END,
    deadline_at = CASE WHEN p_edits ? 'deadline_at' THEN NULLIF(p_edits->>'deadline_at', '')::timestamptz ELSE deadline_at END,
    budget = CASE WHEN p_edits ? 'budget' THEN p_edits->'budget' ELSE budget END,
    updated_at = now()
  WHERE id = p_listing;
  PERFORM public.external_log(p_listing, p_owner, 'owner_edit', jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_edits) AS k)));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hosted applications stay OFF until an admin reviews and enables them for a verified owner.
CREATE OR REPLACE FUNCTION public.set_external_applications(p_listing uuid, p_admin uuid, p_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.external_is_admin(p_admin) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  UPDATE public.external_listings SET applications_enabled = p_enabled, updated_at = now()
   WHERE id = p_listing AND status = 'claimed' AND verification_status = 'owner_verified';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'needs_verified_owner'); END IF;
  PERFORM public.external_log(p_listing, p_admin, CASE WHEN p_enabled THEN 'applications_enabled' ELSE 'applications_disabled' END);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Disputed ownership or a removal request: the listing leaves the public view until an admin resolves it.
CREATE OR REPLACE FUNCTION public.dispute_external_listing(p_listing uuid, p_reporter uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.external_listings SET visibility = 'review', updated_at = now() WHERE id = p_listing AND status IN ('published', 'claimed');
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  UPDATE public.external_listing_claims SET status = 'disputed' WHERE listing_id = p_listing AND status = 'verified';
  PERFORM public.external_log(p_listing, p_reporter, 'disputed', jsonb_build_object('reason', left(COALESCE(p_reason, ''), 1000)));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── spending: reserve BEFORE the external call, settle after, never overshoot a cap under concurrency ───────────────

CREATE OR REPLACE FUNCTION public.reserve_discovery_spend(p_job_key text, p_source text, p_user uuid, p_cents integer, p_ttl_minutes integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  s public.discovery_settings%ROWTYPE;
  src public.discovery_sources%ROWTYPE;
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_scopes text[];
  v_scope text;
  v_cap integer;
  v_after integer;
  v_existing public.discovery_spend_ledger%ROWTYPE;
BEGIN
  IF p_cents < 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount'); END IF;
  SELECT * INTO s FROM public.discovery_settings WHERE id;
  IF NOT s.enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'disabled'); END IF;
  SELECT * INTO src FROM public.discovery_sources WHERE id = p_source;
  IF NOT FOUND OR NOT src.enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'source_disabled'); END IF;

  -- The same job never reserves twice (a retry or an overlapping run reuses its reservation).
  SELECT * INTO v_existing FROM public.discovery_spend_ledger WHERE job_key = p_job_key;
  IF FOUND THEN RETURN jsonb_build_object('ok', v_existing.status = 'reserved', 'reused', true, 'reserved_cents', v_existing.reserved_cents, 'reason', CASE WHEN v_existing.status = 'reserved' THEN NULL ELSE 'already_' || v_existing.status END); END IF;

  v_scopes := ARRAY['global', 'source:' || p_source] || CASE WHEN p_user IS NOT NULL THEN ARRAY['user:' || p_user::text] ELSE ARRAY[]::text[] END;
  BEGIN
    FOR v_scope IN SELECT x FROM unnest(v_scopes) AS x ORDER BY x LOOP     -- a fixed order, so concurrent calls cannot deadlock
      v_cap := CASE WHEN v_scope = 'global' THEN s.daily_ceiling_cents
                    WHEN v_scope LIKE 'source:%' THEN src.daily_budget_cents
                    ELSE s.per_user_daily_cents END;
      v_after := NULL;                                                     -- a refused upsert returns no row: do not reuse the last scope's value
      IF p_cents > v_cap THEN RAISE EXCEPTION 'cap:%', v_scope USING ERRCODE = 'P0001'; END IF;
      INSERT INTO public.discovery_spend_counters AS c (day, scope, spent_cents) VALUES (v_day, v_scope, p_cents)
      ON CONFLICT (day, scope) DO UPDATE SET spent_cents = c.spent_cents + p_cents WHERE c.spent_cents + p_cents <= v_cap
      RETURNING c.spent_cents INTO v_after;
      IF v_after IS NULL THEN RAISE EXCEPTION 'cap:%', v_scope USING ERRCODE = 'P0001'; END IF;
    END LOOP;
    INSERT INTO public.discovery_spend_ledger (job_key, day, scopes, reserved_cents, expires_at)
    VALUES (p_job_key, v_day, v_scopes, p_cents, now() + make_interval(mins => GREATEST(p_ttl_minutes, 1)));
  EXCEPTION
    WHEN unique_violation THEN RETURN jsonb_build_object('ok', true, 'reused', true);   -- a concurrent call with the same job key won; nothing of ours is kept
    WHEN SQLSTATE 'P0001' THEN RETURN jsonb_build_object('ok', false, 'reason', replace(SQLERRM, 'cap:', 'cap_reached:'));
  END;
  RETURN jsonb_build_object('ok', true, 'reserved_cents', p_cents);
END;
$$;

-- Settle the real usage. What was reserved but not used goes back to every scope; usage above the reservation is
-- recorded as the reservation (a caller must reserve what it can spend).
CREATE OR REPLACE FUNCTION public.settle_discovery_spend(p_job_key text, p_actual_cents integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r public.discovery_spend_ledger%ROWTYPE;
  v_actual integer;
  v_scope text;
BEGIN
  UPDATE public.discovery_spend_ledger SET status = 'settled', settled_at = now(), settled_cents = LEAST(GREATEST(p_actual_cents, 0), reserved_cents)
   WHERE job_key = p_job_key AND status = 'reserved' RETURNING * INTO r;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_reserved'); END IF;
  v_actual := r.settled_cents;
  IF r.reserved_cents > v_actual THEN
    FOREACH v_scope IN ARRAY r.scopes LOOP
      UPDATE public.discovery_spend_counters SET spent_cents = GREATEST(spent_cents - (r.reserved_cents - v_actual), 0) WHERE day = r.day AND scope = v_scope;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'settled_cents', v_actual, 'returned_cents', r.reserved_cents - v_actual, 'overrun', p_actual_cents > r.reserved_cents);
END;
$$;

-- Marks abandoned reservations. They stay COUNTED for the day (we cannot prove the call did not happen); an admin
-- reconciles one with settle_discovery_spend after checking the provider's own usage.
CREATE OR REPLACE FUNCTION public.expire_discovery_spend() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ WITH e AS (UPDATE public.discovery_spend_ledger SET status = 'expired' WHERE status = 'reserved' AND expires_at < now() RETURNING 1) SELECT count(*)::int FROM e $$;

-- ── runs: one at a time per source, and a source that keeps failing switches itself off ────────────────────────────

CREATE OR REPLACE FUNCTION public.acquire_discovery_run(p_source text, p_ttl_minutes integer DEFAULT 15) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH l AS (
    UPDATE public.discovery_sources SET run_lock_until = now() + make_interval(mins => GREATEST(p_ttl_minutes, 1))
     WHERE id = p_source AND enabled AND (run_lock_until IS NULL OR run_lock_until < now())
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM l)
$$;

CREATE OR REPLACE FUNCTION public.release_discovery_run(p_source text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ UPDATE public.discovery_sources SET run_lock_until = NULL WHERE id = p_source $$;

-- Never retries indefinitely: the third failure in a row disables the source until a person enables it again.
CREATE OR REPLACE FUNCTION public.record_discovery_run(p_source text, p_ok boolean, p_error text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
  v_failures integer;
BEGIN
  IF p_ok THEN
    UPDATE public.discovery_sources SET consecutive_failures = 0, last_error = NULL, last_run_at = now(), run_lock_until = NULL
     WHERE id = p_source RETURNING enabled, consecutive_failures INTO v_enabled, v_failures;
  ELSE
    UPDATE public.discovery_sources
       SET consecutive_failures = consecutive_failures + 1, last_error = left(COALESCE(p_error, 'failed'), 300), last_run_at = now(), run_lock_until = NULL,
           enabled = CASE WHEN consecutive_failures + 1 >= 3 THEN false ELSE enabled END,
           dead_lettered_at = CASE WHEN consecutive_failures + 1 >= 3 THEN now() ELSE dead_lettered_at END
     WHERE id = p_source RETURNING enabled, consecutive_failures INTO v_enabled, v_failures;
  END IF;
  RETURN jsonb_build_object('enabled', v_enabled, 'consecutive_failures', v_failures);
END;
$$;

-- ── access to the functions: the service role only ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.external_is_admin(uuid)', 'public.external_log(uuid, uuid, text, jsonb)',
    'public.import_external_listing(uuid, jsonb)', 'public.review_external_listing(uuid, uuid, text, text)',
    'public.register_claim_token(uuid, uuid, text, timestamptz)', 'public.redeem_claim_token(text, uuid, uuid)',
    'public.verify_external_claim(uuid, uuid, text, text, uuid)', 'public.owner_update_external_listing(uuid, uuid, jsonb)',
    'public.set_external_applications(uuid, uuid, boolean)', 'public.dispute_external_listing(uuid, uuid, text)',
    'public.reserve_discovery_spend(text, text, uuid, integer, integer)', 'public.settle_discovery_spend(text, integer)',
    'public.expire_discovery_spend()', 'public.acquire_discovery_run(text, integer)', 'public.release_discovery_run(text)',
    'public.record_discovery_run(text, boolean, text)', 'public.reject_external_claim(uuid, uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END
$$;

-- ROLLBACK (loses only what was imported or claimed since; nothing existing is touched):
--   DROP VIEW IF EXISTS public.public_external_listings;
--   DROP TABLE IF EXISTS public.external_listing_events, public.external_listing_claims, public.external_listing_claim_tokens,
--     public.external_listings, public.discovery_spend_ledger, public.discovery_spend_counters, public.discovery_sources,
--     public.discovery_settings CASCADE;
--   DROP FUNCTION IF EXISTS public.external_is_admin(uuid), public.external_log(uuid, uuid, text, jsonb),
--     public.import_external_listing(uuid, jsonb), public.review_external_listing(uuid, uuid, text, text),
--     public.register_claim_token(uuid, uuid, text, timestamptz), public.redeem_claim_token(text, uuid, uuid),
--     public.verify_external_claim(uuid, uuid, text, text, uuid), public.owner_update_external_listing(uuid, uuid, jsonb),
--     public.set_external_applications(uuid, uuid, boolean), public.dispute_external_listing(uuid, uuid, text),
--     public.reserve_discovery_spend(text, text, uuid, integer, integer), public.settle_discovery_spend(text, integer),
--     public.expire_discovery_spend(), public.acquire_discovery_run(text, integer), public.release_discovery_run(text),
--     public.record_discovery_run(text, boolean, text), public.reject_external_claim(uuid, uuid);
