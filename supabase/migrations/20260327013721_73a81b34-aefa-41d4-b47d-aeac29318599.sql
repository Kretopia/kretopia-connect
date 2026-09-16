ALTER TABLE public.creative_jams 
ADD COLUMN IF NOT EXISTS external_ticket_url TEXT,
ADD COLUMN IF NOT EXISTS status_note TEXT;