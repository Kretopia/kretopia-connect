-- Fix: approving a discovered (AI-sourced) credit was setting
-- verification_status = 'verified' immediately — conflating "user confirmed
-- this is theirs" with actual verification (evidence / org confirmation /
-- co-sign). This inflated Passport Stamp counts dishonestly.
--
-- 'auto_discovered' is already an allowed value on the existing
-- credits_verification_status_check constraint (see
-- 20260418195422_61ecc9a0-dcd5-4531-9414-49f15da25bab.sql) — no schema
-- change needed, just correcting what this RPC writes.
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
    _d.thumbnail_url, _d.description, _d.ai_confidence, COALESCE(_d.source, 'discovery'), 'auto_discovered'
  )
  RETURNING id INTO _new_credit_id;

  UPDATE public.discovered_credits
  SET status = 'approved', approved_credit_id = _new_credit_id, approved_at = now()
  WHERE id = _discovery_id;

  RETURN jsonb_build_object('success', true, 'credit_id', _new_credit_id);
END;
$$;
