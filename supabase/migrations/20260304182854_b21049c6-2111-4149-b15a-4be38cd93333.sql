
-- Table to store user email settings for outreach
CREATE TABLE public.user_email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  gmail_email TEXT,
  gmail_app_password TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_email_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own settings
CREATE POLICY "Users manage own email settings"
ON public.user_email_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add scheduled_for column to sequence_emails for auto-scheduling
ALTER TABLE public.sequence_emails ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
