CREATE TABLE public.guest_wallet_email_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_wallet_email_codes_email ON public.guest_wallet_email_codes (email, created_at DESC);

GRANT ALL ON public.guest_wallet_email_codes TO service_role;

ALTER TABLE public.guest_wallet_email_codes ENABLE ROW LEVEL SECURITY;

-- No policies: table is only reachable via service-role backend functions.