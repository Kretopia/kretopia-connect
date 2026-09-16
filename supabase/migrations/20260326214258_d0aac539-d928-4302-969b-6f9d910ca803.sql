
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS double_xp_expires_at timestamptz DEFAULT NULL;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_priority boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS priority_expires_at timestamptz DEFAULT NULL;
