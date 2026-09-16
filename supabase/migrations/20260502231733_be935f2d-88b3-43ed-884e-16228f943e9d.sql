
-- 1. Allow service-side inserts into desk_ai_usage (server uses service role, but we also need this for atomic RPC)
CREATE POLICY "Users can insert their own DeskAI usage"
ON public.desk_ai_usage FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DeskAI usage"
ON public.desk_ai_usage FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Atomic counter RPC for Copilot messages
CREATE OR REPLACE FUNCTION public.consume_copilot_message(_user_id uuid, _daily_cap integer)
RETURNS TABLE(allowed boolean, used integer, cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- -1 cap means unlimited
  IF _daily_cap = -1 THEN
    INSERT INTO public.desk_ai_usage (user_id, usage_date, message_count)
    VALUES (_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET message_count = desk_ai_usage.message_count + 1, updated_at = now()
    RETURNING message_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  -- Get current count
  SELECT message_count INTO v_count
  FROM public.desk_ai_usage
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _daily_cap THEN
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.desk_ai_usage (user_id, usage_date, message_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = desk_ai_usage.message_count + 1, updated_at = now()
  RETURNING message_count INTO v_count;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_copilot_message(uuid, integer) TO authenticated, service_role;

-- 3. Ambassador attribution columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ambassador_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_ambassador text;

CREATE INDEX IF NOT EXISTS idx_profiles_ambassador_code ON public.profiles(ambassador_code) WHERE ambassador_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_ambassador ON public.profiles(referred_by_ambassador) WHERE referred_by_ambassador IS NOT NULL;

-- 4. Public lookup function: resolve an ambassador code to a profile (safe — only returns code-holders)
CREATE OR REPLACE FUNCTION public.get_ambassador_by_code(_code text)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, ambassador_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, p.ambassador_code
  FROM public.profiles p
  WHERE p.ambassador_code = upper(_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_by_code(text) TO anon, authenticated;

-- 5. Auto-mint ambassador code when application is approved
CREATE OR REPLACE FUNCTION public.mint_ambassador_code_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Skip if user already has a code
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id AND ambassador_code IS NOT NULL) THEN
      RETURN NEW;
    END IF;

    LOOP
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      BEGIN
        UPDATE public.profiles SET ambassador_code = v_code WHERE user_id = NEW.user_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_attempts := v_attempts + 1;
        IF v_attempts > 5 THEN RAISE; END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mint_ambassador_code ON public.ambassador_applications;
CREATE TRIGGER trg_mint_ambassador_code
AFTER UPDATE ON public.ambassador_applications
FOR EACH ROW EXECUTE FUNCTION public.mint_ambassador_code_on_approval();
