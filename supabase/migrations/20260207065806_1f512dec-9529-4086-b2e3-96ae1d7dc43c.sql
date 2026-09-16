
-- OAuth Applications (registered third-party apps like Anansi)
CREATE TABLE public.oauth_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  name TEXT NOT NULL,
  description TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth Authorization Codes (short-lived, exchanged for tokens)
CREATE TABLE public.oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  app_id UUID NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{profile}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth Access Tokens
CREATE TABLE public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  app_id UUID NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{profile}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- OAuth Apps: Only owner can manage their apps, anyone can read active apps (for auth flow)
CREATE POLICY "Anyone can read active oauth apps"
  ON public.oauth_apps FOR SELECT
  USING (is_active = true);

CREATE POLICY "Owner can manage their oauth apps"
  ON public.oauth_apps FOR ALL
  USING (auth.uid() = owner_id);

-- OAuth Codes: Only the user who authorized can see their codes
CREATE POLICY "Users can view their own oauth codes"
  ON public.oauth_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create oauth codes"
  ON public.oauth_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- OAuth Tokens: Users can manage their own tokens
CREATE POLICY "Users can view their own oauth tokens"
  ON public.oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own tokens"
  ON public.oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role policies for edge functions (codes and tokens need server-side access)
CREATE POLICY "Service role manages oauth codes"
  ON public.oauth_codes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages oauth tokens"
  ON public.oauth_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_oauth_codes_code ON public.oauth_codes(code) WHERE NOT used;
CREATE INDEX idx_oauth_tokens_access_token ON public.oauth_tokens(access_token) WHERE NOT revoked;
CREATE INDEX idx_oauth_codes_expires ON public.oauth_codes(expires_at);
CREATE INDEX idx_oauth_tokens_expires ON public.oauth_tokens(expires_at);

-- Pre-register Anansi as the first OAuth app
INSERT INTO public.oauth_apps (name, description, redirect_uris, is_active)
VALUES (
  'Anansi',
  'Short-form drama platform - Sign in with ThriveIN',
  ARRAY['http://localhost:3000/auth/callback', 'https://anansi.app/auth/callback'],
  true
);
