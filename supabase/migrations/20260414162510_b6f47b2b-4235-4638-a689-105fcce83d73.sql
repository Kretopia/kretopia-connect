
ALTER TABLE public.jam_participants ADD COLUMN IF NOT EXISTS check_in_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE public.jam_participants ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Update existing rows that don't have tokens
UPDATE public.jam_participants SET check_in_token = encode(gen_random_bytes(16), 'hex') WHERE check_in_token IS NULL;

-- Make check_in_token NOT NULL after backfill
ALTER TABLE public.jam_participants ALTER COLUMN check_in_token SET NOT NULL;
