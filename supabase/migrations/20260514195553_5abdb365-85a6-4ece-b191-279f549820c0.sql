
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS require_account_for_rsvp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_matching_enabled boolean NOT NULL DEFAULT true;
