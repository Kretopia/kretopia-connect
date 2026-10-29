CREATE TABLE IF NOT EXISTS public.username_login_links (
  legacy_user_id uuid PRIMARY KEY,
  email text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.username_login_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.username_login_links FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.username_login_links TO service_role;