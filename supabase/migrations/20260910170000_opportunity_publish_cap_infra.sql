-- "Bible" item: opportunity publishing caps.
--
-- No org/workspace layer exists yet in this schema (confirmed: no
-- organizations/workspace table anywhere in supabase/migrations), so this
-- is scoped per-user (created_by) with room to add an org_id join later
-- once that layer exists -- not implemented speculatively here.
--
-- Adds:
--   - a per-user override table (admin can raise/lower a specific user's
--     cap; NULL means "use the platform default");
--   - get_opportunity_publish_cap() resolving override -> platform default;
--   - a trigger that blocks a create/reactivate transition to
--     status = 'active' once the user is at/over their cap on
--     concurrently-active opportunities.
--
-- The platform default is set to an effectively-unlimited value
-- (DEFAULT_MAX_ACTIVE_OPPORTUNITIES = 999999) -- the exact real cap is a
-- product decision (how many active listings is normal vs. spam/abuse,
-- whether it should vary by plan tier) that hasn't been made yet. TODO
-- product decision: replace 999999 below with a real number (and/or make
-- it tier-aware) once decided -- everything else (the counting, the
-- override table, the enforcement trigger) is already live and needs no
-- further schema change to activate.

CREATE TABLE IF NOT EXISTS public.user_opportunity_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_active_opportunities INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.user_opportunity_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own opportunity limit"
ON public.user_opportunity_limits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage opportunity limits"
ON public.user_opportunity_limits FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_opportunity_publish_cap(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT max_active_opportunities FROM public.user_opportunity_limits WHERE user_id = _user_id),
    999999 -- TODO product decision: real platform-default cap
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_opportunity_publish_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap INTEGER;
  v_active_count INTEGER;
BEGIN
  -- Only re-check when a row is becoming active (new active listing, or a
  -- draft/closed one being reactivated) -- edits to an already-active row
  -- that stay active don't consume a new slot.
  IF NEW.status <> 'active' OR (TG_OP = 'UPDATE' AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  v_cap := public.get_opportunity_publish_cap(NEW.created_by);

  SELECT count(*) INTO v_active_count
  FROM public.opportunities
  WHERE created_by = NEW.created_by
    AND status = 'active'
    AND id IS DISTINCT FROM NEW.id;

  IF v_active_count >= v_cap THEN
    RAISE EXCEPTION 'Active opportunity limit reached (%/%). Close an existing opportunity before publishing a new one.', v_active_count, v_cap
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opportunities_enforce_publish_cap ON public.opportunities;
CREATE TRIGGER opportunities_enforce_publish_cap
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_publish_cap();
