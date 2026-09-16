-- Staging table for credit candidates discovered by scans
CREATE TABLE IF NOT EXISTS public.discovered_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scan_id UUID REFERENCES public.discovery_scans(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  role TEXT,
  year INTEGER,
  credit_category TEXT,
  platform TEXT,
  url TEXT,
  thumbnail_url TEXT,
  description TEXT,
  ai_confidence NUMERIC,
  source TEXT,
  source_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | dismissed
  approved_credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovered_credits_user_status 
  ON public.discovered_credits(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_credits_dedupe
  ON public.discovered_credits(user_id, lower(project_name), lower(coalesce(role,'')));

ALTER TABLE public.discovered_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own discovered credits"
  ON public.discovered_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own discovered credits"
  ON public.discovered_credits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert discovered credits"
  ON public.discovered_credits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users delete their own discovered credits"
  ON public.discovered_credits FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_discovered_credits_updated_at
  BEFORE UPDATE ON public.discovered_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approve a discovered credit -> insert into credits
CREATE OR REPLACE FUNCTION public.approve_discovered_credit(_discovery_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _d RECORD;
  _new_credit_id UUID;
  _existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _d FROM public.discovered_credits 
  WHERE id = _discovery_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discovery not found');
  END IF;

  IF _d.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already ' || _d.status);
  END IF;

  -- Skip if already exists in credits
  SELECT id INTO _existing FROM public.credits
  WHERE user_id = auth.uid()
    AND lower(project_name) = lower(_d.project_name)
    AND lower(coalesce(role,'')) = lower(coalesce(_d.role,''))
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    UPDATE public.discovered_credits
    SET status = 'approved', approved_credit_id = _existing, approved_at = now()
    WHERE id = _discovery_id;
    RETURN jsonb_build_object('success', true, 'credit_id', _existing, 'note', 'already_existed');
  END IF;

  INSERT INTO public.credits (
    user_id, project_name, role, year, credit_category, platform, url, 
    thumbnail_url, description, ai_confidence, source, verification_status
  ) VALUES (
    auth.uid(), _d.project_name, _d.role, _d.year, _d.credit_category, _d.platform, _d.url,
    _d.thumbnail_url, _d.description, _d.ai_confidence, COALESCE(_d.source, 'discovery'), 'verified'
  )
  RETURNING id INTO _new_credit_id;

  UPDATE public.discovered_credits
  SET status = 'approved', approved_credit_id = _new_credit_id, approved_at = now()
  WHERE id = _discovery_id;

  RETURN jsonb_build_object('success', true, 'credit_id', _new_credit_id);
END;
$$;

-- Dismiss a discovered credit
CREATE OR REPLACE FUNCTION public.dismiss_discovered_credit(_discovery_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.discovered_credits
  SET status = 'dismissed', dismissed_at = now()
  WHERE id = _discovery_id AND user_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discovery not found or already actioned');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;