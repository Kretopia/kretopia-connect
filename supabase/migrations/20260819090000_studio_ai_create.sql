-- Studio AI Create: image + copy generation inside a project's "Create" tab.
--
-- WRITTEN FOR REVIEW. NOT APPLIED TO THE LIVE DATABASE. Per the standing
-- rule for this repo, database changes require explicit human review
-- before being applied via the Lovable Cloud SQL editor.
--
-- Mirrors the already-live, proven-in-production pattern from
-- consume_copilot_message (supabase/migrations/20260502231733_...sql,
-- used by supabase/functions/thrive-ai-chat/index.ts): a small per-user
-- daily-usage table plus an atomic SECURITY DEFINER RPC that checks the
-- cap and increments in one statement, avoiding a check-then-write race
-- between concurrent requests. A companion refund RPC lets the edge
-- functions give back a unit if the paid Lovable AI Gateway call itself
-- fails after the quota was already consumed, so a failed generation
-- doesn't permanently cost the user part of their daily allowance.

CREATE TABLE IF NOT EXISTS public.studio_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  generation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.studio_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Studio AI usage"
  ON public.studio_ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Row writes normally happen through the SECURITY DEFINER RPCs below (so
-- the service-role edge functions can call them on the caller's behalf),
-- but these policies also let an authenticated client write its own row
-- directly if ever needed, mirroring desk_ai_usage's equivalent policies.
CREATE POLICY "Users can insert their own Studio AI usage"
  ON public.studio_ai_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Studio AI usage"
  ON public.studio_ai_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- update_updated_at_column() already exists in this project (used by many
-- other tables' triggers) — reused here rather than redefined.
CREATE TRIGGER update_studio_ai_usage_updated_at
  BEFORE UPDATE ON public.studio_ai_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic check-and-increment. _daily_cap = -1 means unlimited (Pro).
CREATE OR REPLACE FUNCTION public.consume_studio_ai_generation(_user_id uuid, _daily_cap integer)
RETURNS TABLE(allowed boolean, used integer, cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _daily_cap = -1 THEN
    INSERT INTO public.studio_ai_usage (user_id, usage_date, generation_count)
    VALUES (_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET generation_count = studio_ai_usage.generation_count + 1, updated_at = now()
    RETURNING generation_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  SELECT generation_count INTO v_count
  FROM public.studio_ai_usage
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _daily_cap THEN
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.studio_ai_usage (user_id, usage_date, generation_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET generation_count = studio_ai_usage.generation_count + 1, updated_at = now()
  RETURNING generation_count INTO v_count;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_studio_ai_generation(uuid, integer) TO authenticated, service_role;

-- Best-effort refund when a quota-consuming generation fails downstream
-- (e.g. the Lovable AI Gateway call itself errors after the cap check
-- already succeeded). Never lets the count go below zero.
CREATE OR REPLACE FUNCTION public.refund_studio_ai_generation(_user_id uuid, _usage_date date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.studio_ai_usage
  SET generation_count = GREATEST(0, generation_count - 1), updated_at = now()
  WHERE user_id = _user_id AND usage_date = _usage_date;
$$;

GRANT EXECUTE ON FUNCTION public.refund_studio_ai_generation(uuid, date) TO service_role;

-- Provenance columns so a generated asset can be told apart from an
-- uploaded one in the existing Asset Library (CreativeAssetLibrary.tsx),
-- rather than building a second, parallel storage system.
ALTER TABLE public.creative_assets
  ADD COLUMN IF NOT EXISTS source text CHECK (source IS NULL OR source IN ('upload', 'ai')),
  ADD COLUMN IF NOT EXISTS generation_prompt text,
  ADD COLUMN IF NOT EXISTS generation_model text;
