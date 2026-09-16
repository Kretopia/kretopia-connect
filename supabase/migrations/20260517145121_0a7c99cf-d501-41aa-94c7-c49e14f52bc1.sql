
-- =====================================================================
-- Sound Stages — Phase 2: Scout & Showcase Stages
-- =====================================================================

-- Stage type + status enums
DO $$ BEGIN
  CREATE TYPE public.curated_stage_type AS ENUM ('showcase', 'scout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.curated_stage_status AS ENUM ('draft','scheduled','live','ended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.curated_rsvp_status AS ENUM ('rsvp','waitlist','attended','no_show','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.curated_application_status AS ENUM ('pending','accepted','declined','waitlist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.curated_turn_outcome AS ENUM ('co_sign','credit','rolodex','followup','pass','timeout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- curated_stages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.curated_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  type public.curated_stage_type NOT NULL,
  title text NOT NULL,
  blurb text,
  cover_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  capacity int NOT NULL DEFAULT 50 CHECK (capacity >= 1 AND capacity <= 1000),
  is_paid boolean NOT NULL DEFAULT false,
  price_cents int DEFAULT 0,
  currency text DEFAULT 'USD',
  status public.curated_stage_status NOT NULL DEFAULT 'scheduled',
  room_url text,
  room_name text,
  recording_enabled boolean NOT NULL DEFAULT false,
  recording_url text,
  vibe_tags text[] DEFAULT '{}',
  application_required boolean NOT NULL DEFAULT false,
  application_prompt text,
  turn_seconds int NOT NULL DEFAULT 120 CHECK (turn_seconds BETWEEN 30 AND 600),
  rsvp_count int NOT NULL DEFAULT 0,
  attended_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curated_stages_starts ON public.curated_stages (starts_at);
CREATE INDEX IF NOT EXISTS idx_curated_stages_host ON public.curated_stages (host_user_id);
CREATE INDEX IF NOT EXISTS idx_curated_stages_status ON public.curated_stages (status);
ALTER TABLE public.curated_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view scheduled or live stages" ON public.curated_stages;
CREATE POLICY "Anyone can view scheduled or live stages"
  ON public.curated_stages FOR SELECT
  USING (status IN ('scheduled','live','ended') OR host_user_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can insert their own stage" ON public.curated_stages;
CREATE POLICY "Hosts can insert their own stage"
  ON public.curated_stages FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can update their own stage" ON public.curated_stages;
CREATE POLICY "Hosts can update their own stage"
  ON public.curated_stages FOR UPDATE
  USING (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can delete their own draft stage" ON public.curated_stages;
CREATE POLICY "Hosts can delete their own draft stage"
  ON public.curated_stages FOR DELETE
  USING (host_user_id = auth.uid() AND status IN ('draft','cancelled'));

-- =====================================================================
-- curated_stage_rsvps
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.curated_stage_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.curated_rsvp_status NOT NULL DEFAULT 'rsvp',
  ticket_order_id uuid,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_curated_rsvps_stage ON public.curated_stage_rsvps (stage_id);
CREATE INDEX IF NOT EXISTS idx_curated_rsvps_user ON public.curated_stage_rsvps (user_id);
ALTER TABLE public.curated_stage_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can see own rsvp or stage host can see all" ON public.curated_stage_rsvps;
CREATE POLICY "User can see own rsvp or stage host can see all"
  ON public.curated_stage_rsvps FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.curated_stages s
      WHERE s.id = stage_id AND s.host_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User can rsvp themself" ON public.curated_stage_rsvps;
CREATE POLICY "User can rsvp themself"
  ON public.curated_stage_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "User can update own rsvp" ON public.curated_stage_rsvps;
CREATE POLICY "User can update own rsvp"
  ON public.curated_stage_rsvps FOR UPDATE
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.curated_stages s
      WHERE s.id = stage_id AND s.host_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User can cancel own rsvp" ON public.curated_stage_rsvps;
CREATE POLICY "User can cancel own rsvp"
  ON public.curated_stage_rsvps FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================================
-- curated_stage_applications
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.curated_stage_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pitch text,
  voice_url text,
  status public.curated_application_status NOT NULL DEFAULT 'pending',
  match_score numeric,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_curated_apps_stage ON public.curated_stage_applications (stage_id);
CREATE INDEX IF NOT EXISTS idx_curated_apps_user ON public.curated_stage_applications (user_id);
ALTER TABLE public.curated_stage_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicant or host can view" ON public.curated_stage_applications;
CREATE POLICY "Applicant or host can view"
  ON public.curated_stage_applications FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.curated_stages s
      WHERE s.id = stage_id AND s.host_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User can apply" ON public.curated_stage_applications;
CREATE POLICY "User can apply"
  ON public.curated_stage_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Host can review applications" ON public.curated_stage_applications;
CREATE POLICY "Host can review applications"
  ON public.curated_stage_applications FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = stage_id AND s.host_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Applicant can withdraw" ON public.curated_stage_applications;
CREATE POLICY "Applicant can withdraw"
  ON public.curated_stage_applications FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================================
-- curated_stage_turns (audition log)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.curated_stage_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  applicant_user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome public.curated_turn_outcome,
  host_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curated_turns_stage ON public.curated_stage_turns (stage_id);
ALTER TABLE public.curated_stage_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host or applicant can view turn" ON public.curated_stage_turns;
CREATE POLICY "Host or applicant can view turn"
  ON public.curated_stage_turns FOR SELECT
  USING (
    applicant_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.curated_stages s
      WHERE s.id = stage_id AND s.host_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Host can manage turns" ON public.curated_stage_turns;
CREATE POLICY "Host can manage turns"
  ON public.curated_stage_turns FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = stage_id AND s.host_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = stage_id AND s.host_user_id = auth.uid()
  ));

-- =====================================================================
-- updated_at trigger
-- =====================================================================
DROP TRIGGER IF EXISTS trg_curated_stages_updated_at ON public.curated_stages;
CREATE TRIGGER trg_curated_stages_updated_at
  BEFORE UPDATE ON public.curated_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RSVP counter trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recount_curated_stage_rsvps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage uuid;
BEGIN
  v_stage := COALESCE(NEW.stage_id, OLD.stage_id);
  UPDATE public.curated_stages s
  SET rsvp_count = (
    SELECT count(*) FROM public.curated_stage_rsvps r
    WHERE r.stage_id = v_stage AND r.status IN ('rsvp','attended')
  )
  WHERE s.id = v_stage;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_curated_rsvp_counter ON public.curated_stage_rsvps;
CREATE TRIGGER trg_curated_rsvp_counter
  AFTER INSERT OR UPDATE OR DELETE ON public.curated_stage_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.recount_curated_stage_rsvps();

-- =====================================================================
-- Application gating RPC (tier-aware monthly cap)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.curated_stage_app_usage (
  user_id uuid NOT NULL,
  usage_month date NOT NULL,
  application_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_month)
);
ALTER TABLE public.curated_stage_app_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own app usage" ON public.curated_stage_app_usage;
CREATE POLICY "User reads own app usage" ON public.curated_stage_app_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consume_stage_application(_user_id uuid, _monthly_cap int)
RETURNS TABLE(allowed boolean, used int, cap int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_count int;
BEGIN
  IF _monthly_cap = -1 THEN
    INSERT INTO public.curated_stage_app_usage (user_id, usage_month, application_count)
    VALUES (_user_id, v_month, 1)
    ON CONFLICT (user_id, usage_month)
    DO UPDATE SET application_count = curated_stage_app_usage.application_count + 1, updated_at = now()
    RETURNING application_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  SELECT application_count INTO v_count
  FROM public.curated_stage_app_usage
  WHERE user_id = _user_id AND usage_month = v_month;

  IF v_count IS NULL THEN v_count := 0; END IF;

  IF v_count >= _monthly_cap THEN
    RETURN QUERY SELECT false, v_count, _monthly_cap;
    RETURN;
  END IF;

  INSERT INTO public.curated_stage_app_usage (user_id, usage_month, application_count)
  VALUES (_user_id, v_month, 1)
  ON CONFLICT (user_id, usage_month)
  DO UPDATE SET application_count = curated_stage_app_usage.application_count + 1, updated_at = now()
  RETURNING application_count INTO v_count;

  RETURN QUERY SELECT true, v_count, _monthly_cap;
END;
$$;

-- =====================================================================
-- Realtime
-- =====================================================================
ALTER TABLE public.curated_stages REPLICA IDENTITY FULL;
ALTER TABLE public.curated_stage_rsvps REPLICA IDENTITY FULL;
ALTER TABLE public.curated_stage_applications REPLICA IDENTITY FULL;
ALTER TABLE public.curated_stage_turns REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.curated_stages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.curated_stage_rsvps;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.curated_stage_applications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.curated_stage_turns;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
