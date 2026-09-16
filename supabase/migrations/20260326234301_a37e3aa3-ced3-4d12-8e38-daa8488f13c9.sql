
-- Partner tracking links for organizations (non-commission, tracking only)
CREATE TABLE IF NOT EXISTS public.partner_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  partner_code TEXT NOT NULL UNIQUE,
  description TEXT,
  contact_name TEXT,
  contact_email TEXT,
  max_uses INTEGER DEFAULT 500,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_invite_links ENABLE ROW LEVEL SECURITY;

-- Only admins manage, but the validate function uses service role
CREATE POLICY "Allow public read of active partner links"
ON public.partner_invite_links FOR SELECT
USING (is_active = true);

-- Track which users signed up via partner links
CREATE TABLE IF NOT EXISTS public.partner_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_link_id UUID REFERENCES public.partner_invite_links(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  signed_up_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_signups ENABLE ROW LEVEL SECURITY;

-- Add partner_code tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS partner_code_used TEXT;

-- Function to consume a partner invite code
CREATE OR REPLACE FUNCTION public.use_partner_code(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record RECORD;
BEGIN
  SELECT * INTO link_record
  FROM partner_invite_links
  WHERE partner_code = UPPER(p_code)
    AND is_active = true
    AND current_uses < max_uses;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Increment usage
  UPDATE partner_invite_links
  SET current_uses = current_uses + 1, updated_at = now()
  WHERE id = link_record.id;

  -- Track the signup
  INSERT INTO partner_signups (partner_link_id, user_id)
  VALUES (link_record.id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- Update profile
  UPDATE profiles
  SET partner_code_used = UPPER(p_code)
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;
