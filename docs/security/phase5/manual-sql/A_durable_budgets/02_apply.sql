-- LOT A -- durable budgets (CREATION) -- 02 APPLY.
-- Run it ONLY in the SQL Editor of the Lovable project "kretopia-app", after 01_preflight.sql ended with its result row.
-- One transaction. It creates two tables and three functions, all new; it changes and deletes nothing that exists.
--
-- What it gives the edge functions (service role only):
--   reserve_budget(bucket, window_seconds, limit, units, ttl_seconds)  -> allowed, reservation_id, used, reserved, remaining
--   commit_budget(reservation_id)    -> true when the reservation became usage
--   release_budget(reservation_id)   -> true when the reservation was given back
-- The count can never pass the limit: the bucket row is locked by every reserver, the reservation is a conditional update,
-- and a CHECK constraint (used + reserved <= limit) makes an overshoot impossible even if the function were bypassed.

BEGIN;

-- Same assertions as the preflight, inside the transaction: if anything of these names appeared in between, stop.
DO $assert$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname IN ('budget_buckets', 'budget_reservations'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname IN ('reserve_budget', 'commit_budget', 'release_budget')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: an object of this lot already exists. Nothing was changed.';
  END IF;
  IF to_regprocedure('auth.role()') IS NULL OR to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: auth.role() or gen_random_uuid() is missing. Nothing was changed.';
  END IF;
END
$assert$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.budget_buckets (
  bucket_key     text        NOT NULL,
  window_start   timestamptz NOT NULL,
  limit_units    integer     NOT NULL,
  used_units     integer     NOT NULL DEFAULT 0,
  reserved_units integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_buckets_pkey PRIMARY KEY (bucket_key, window_start),
  CONSTRAINT budget_buckets_key_length CHECK (char_length(bucket_key) BETWEEN 1 AND 200),
  CONSTRAINT budget_buckets_limit_not_negative CHECK (limit_units >= 0),
  CONSTRAINT budget_buckets_counts_not_negative CHECK (used_units >= 0 AND reserved_units >= 0),
  CONSTRAINT budget_buckets_never_over_limit CHECK (used_units + reserved_units <= limit_units)
);

CREATE TABLE public.budget_reservations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  units        integer     NOT NULL,
  status       text        NOT NULL DEFAULT 'reserved',
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  settled_at   timestamptz,
  CONSTRAINT budget_reservations_bucket_fkey FOREIGN KEY (bucket_key, window_start)
    REFERENCES public.budget_buckets (bucket_key, window_start),
  CONSTRAINT budget_reservations_units_positive CHECK (units > 0),
  CONSTRAINT budget_reservations_status_known CHECK (status IN ('reserved', 'committed', 'released', 'expired')),
  CONSTRAINT budget_reservations_settled_iff_closed CHECK ((status = 'reserved') = (settled_at IS NULL))
);

CREATE INDEX budget_reservations_open_idx ON public.budget_reservations (bucket_key, window_start, expires_at) WHERE status = 'reserved';
CREATE INDEX budget_buckets_window_idx ON public.budget_buckets (window_start);

-- Clients have no access at all: RLS on with no policy, and no privilege for anon/authenticated. The service role may READ (to
-- monitor the counters) but not write: the counters move only through the three functions below, which run as their owner.
-- (Supabase grants every new table to anon, authenticated and service_role by default; the REVOKE removes all three.)
ALTER TABLE public.budget_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.budget_buckets, public.budget_reservations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.budget_buckets, public.budget_reservations TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- reserve_budget: take `p_units` from the bucket of the current window, or say no.
--   * The window is a fixed slot aligned on the epoch (an hour is 14:00-15:00 UTC); the FIRST call of a window fixes its limit.
--   * Every caller of the same bucket-window queues on the bucket row (FOR UPDATE); the reservation itself is a conditional
--     UPDATE, so even without the lock the count cannot pass the limit.
--   * Reservations whose time-to-live passed are given back first, under the same lock.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.reserve_budget(
  p_bucket         text,
  p_window_seconds integer,
  p_limit          integer,
  p_units          integer DEFAULT 1,
  p_ttl_seconds    integer DEFAULT 300
)
RETURNS TABLE (allowed boolean, reservation_id uuid, used integer, reserved integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ws    timestamptz;
  v_limit integer;
  v_id    uuid;
  v_used  integer;
  v_resv  integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'reserve_budget is for the service role' USING ERRCODE = '42501';
  END IF;
  IF p_bucket IS NULL OR char_length(p_bucket) NOT BETWEEN 1 AND 200
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 31536000
     OR p_limit IS NULL OR p_limit NOT BETWEEN 0 AND 100000000
     OR p_units IS NULL OR p_units NOT BETWEEN 1 AND 100000000
     OR p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'invalid budget request' USING ERRCODE = '22023';
  END IF;

  v_ws := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  -- The bucket exists from now on; the row lock below serialises every reserver of this bucket-window.
  INSERT INTO public.budget_buckets (bucket_key, window_start, limit_units)
  VALUES (p_bucket, v_ws, p_limit)
  ON CONFLICT (bucket_key, window_start) DO NOTHING;

  SELECT b.limit_units INTO v_limit
  FROM public.budget_buckets b
  WHERE b.bucket_key = p_bucket AND b.window_start = v_ws
  FOR UPDATE;

  -- Give back what expired (a caller that crashed before commit or release).
  WITH expired AS (
    UPDATE public.budget_reservations r
       SET status = 'expired', settled_at = now()
     WHERE r.bucket_key = p_bucket AND r.window_start = v_ws AND r.status = 'reserved' AND r.expires_at < now()
    RETURNING r.units
  )
  UPDATE public.budget_buckets b
     SET reserved_units = b.reserved_units - (SELECT sum(e.units) FROM expired e)::integer,
         updated_at = now()
   WHERE b.bucket_key = p_bucket AND b.window_start = v_ws AND EXISTS (SELECT 1 FROM expired);

  -- Reserve: conditional, so the count cannot pass the limit even if the lock above were somehow missing.
  UPDATE public.budget_buckets b
     SET reserved_units = b.reserved_units + p_units, updated_at = now()
   WHERE b.bucket_key = p_bucket AND b.window_start = v_ws
     AND b.used_units + b.reserved_units + p_units <= b.limit_units
  RETURNING b.used_units, b.reserved_units INTO v_used, v_resv;

  IF NOT FOUND THEN
    SELECT b.used_units, b.reserved_units INTO v_used, v_resv
    FROM public.budget_buckets b WHERE b.bucket_key = p_bucket AND b.window_start = v_ws;
    RETURN QUERY SELECT false, NULL::uuid, v_used, v_resv, greatest(v_limit - v_used - v_resv, 0);
    RETURN;
  END IF;

  INSERT INTO public.budget_reservations (bucket_key, window_start, units, expires_at)
  VALUES (p_bucket, v_ws, p_units, now() + make_interval(secs => p_ttl_seconds))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, v_used, v_resv, v_limit - v_used - v_resv;
END
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------
-- commit_budget / release_budget: settle a reservation once. They take the bucket lock first (the same order as
-- reserve_budget, so they cannot deadlock with it) and move the units with a conditional update on the reservation:
-- a reservation is settled at most once, whoever calls and however many times.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.commit_budget(p_reservation uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_bucket text;
  v_ws     timestamptz;
  v_units  integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'commit_budget is for the service role' USING ERRCODE = '42501';
  END IF;
  IF p_reservation IS NULL THEN
    RAISE EXCEPTION 'invalid budget request' USING ERRCODE = '22023';
  END IF;

  SELECT r.bucket_key, r.window_start INTO v_bucket, v_ws FROM public.budget_reservations r WHERE r.id = p_reservation;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM 1 FROM public.budget_buckets b WHERE b.bucket_key = v_bucket AND b.window_start = v_ws FOR UPDATE;

  UPDATE public.budget_reservations r
     SET status = 'committed', settled_at = now()
   WHERE r.id = p_reservation AND r.status = 'reserved'
  RETURNING r.units INTO v_units;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.budget_buckets b
     SET reserved_units = b.reserved_units - v_units, used_units = b.used_units + v_units, updated_at = now()
   WHERE b.bucket_key = v_bucket AND b.window_start = v_ws;
  RETURN true;
END
$fn$;

CREATE FUNCTION public.release_budget(p_reservation uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_bucket text;
  v_ws     timestamptz;
  v_units  integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'release_budget is for the service role' USING ERRCODE = '42501';
  END IF;
  IF p_reservation IS NULL THEN
    RAISE EXCEPTION 'invalid budget request' USING ERRCODE = '22023';
  END IF;

  SELECT r.bucket_key, r.window_start INTO v_bucket, v_ws FROM public.budget_reservations r WHERE r.id = p_reservation;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM 1 FROM public.budget_buckets b WHERE b.bucket_key = v_bucket AND b.window_start = v_ws FOR UPDATE;

  UPDATE public.budget_reservations r
     SET status = 'released', settled_at = now()
   WHERE r.id = p_reservation AND r.status = 'reserved'
  RETURNING r.units INTO v_units;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.budget_buckets b
     SET reserved_units = b.reserved_units - v_units, updated_at = now()
   WHERE b.bucket_key = v_bucket AND b.window_start = v_ws;
  RETURN true;
END
$fn$;

-- Only the service role may call them. anon and authenticated cannot, and neither can PUBLIC.
REVOKE ALL ON FUNCTION public.reserve_budget(text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_budget(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_budget(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_budget(text, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_budget(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_budget(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Smoke test, inside this transaction. Its rows are rolled back (the block raises on purpose and catches it), so the tables
-- are left empty. If any step is not as expected the whole script stops and nothing is created.
-- ---------------------------------------------------------------------------------------------------------------------
DO $smoke$
DECLARE
  r1 record; r2 record; r3 record; r4 record;
  ok boolean;
BEGIN
  BEGIN
    SELECT * INTO r1 FROM public.reserve_budget('smoke:a', 3600, 2, 1, 300);
    SELECT * INTO r2 FROM public.reserve_budget('smoke:a', 3600, 2, 1, 300);
    SELECT * INTO r3 FROM public.reserve_budget('smoke:a', 3600, 2, 1, 300);
    IF NOT (r1.allowed AND r2.allowed AND NOT r3.allowed AND r3.remaining = 0 AND r2.reserved = 2) THEN
      RAISE EXCEPTION 'SMOKE FAILED: the limit of 2 was not enforced (%, %, %)', r1.allowed, r2.allowed, r3.allowed;
    END IF;

    SELECT public.commit_budget(r1.reservation_id) INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'SMOKE FAILED: commit did not settle'; END IF;
    SELECT public.commit_budget(r1.reservation_id) INTO ok;
    IF ok THEN RAISE EXCEPTION 'SMOKE FAILED: a reservation was settled twice'; END IF;

    SELECT public.release_budget(r2.reservation_id) INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'SMOKE FAILED: release did not settle'; END IF;
    SELECT public.release_budget(r2.reservation_id) INTO ok;
    IF ok THEN RAISE EXCEPTION 'SMOKE FAILED: a reservation was released twice'; END IF;
    SELECT public.commit_budget(r2.reservation_id) INTO ok;
    IF ok THEN RAISE EXCEPTION 'SMOKE FAILED: a released reservation was committed'; END IF;

    -- 1 used, 0 reserved: one unit is free again
    SELECT * INTO r4 FROM public.reserve_budget('smoke:a', 3600, 2, 1, 300);
    IF NOT (r4.allowed AND r4.used = 1 AND r4.reserved = 1) THEN
      RAISE EXCEPTION 'SMOKE FAILED: released units were not available again (%, %, %)', r4.allowed, r4.used, r4.reserved;
    END IF;

    -- A request for more than the limit is a refusal, not an error
    SELECT * INTO r4 FROM public.reserve_budget('smoke:b', 3600, 2, 5, 300);
    IF r4.allowed THEN RAISE EXCEPTION 'SMOKE FAILED: more units than the limit were granted'; END IF;

    -- An expired reservation is given back by the next reserver
    SELECT * INTO r1 FROM public.reserve_budget('smoke:c', 3600, 1, 1, 1);
    UPDATE public.budget_reservations SET expires_at = now() - interval '1 minute' WHERE id = r1.reservation_id;
    SELECT * INTO r2 FROM public.reserve_budget('smoke:c', 3600, 1, 1, 300);
    IF NOT r2.allowed THEN RAISE EXCEPTION 'SMOKE FAILED: an expired reservation kept its units'; END IF;

    RAISE EXCEPTION 'SMOKE_OK';   -- rolls this block back: no smoke row survives
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SMOKE_OK' THEN RAISE; END IF;
  END;
END
$smoke$;

DO $empty$
BEGIN
  IF EXISTS (SELECT 1 FROM public.budget_buckets) OR EXISTS (SELECT 1 FROM public.budget_reservations) THEN
    RAISE EXCEPTION 'APPLY STOPPED: the smoke test left rows behind. Nothing was changed.';
  END IF;
END
$empty$;

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify.sql' AS next_step;
