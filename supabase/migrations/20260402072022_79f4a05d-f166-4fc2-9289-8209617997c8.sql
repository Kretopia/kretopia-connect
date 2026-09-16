
-- Add scout/claim fields to opportunities
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS scouted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS original_source_text TEXT,
  ADD COLUMN IF NOT EXISTS source_platform TEXT;

-- Create index for claim token lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_claim_token ON public.opportunities(claim_token) WHERE claim_token IS NOT NULL;

-- Allow public read on opportunities with claim tokens (for claim page)
-- Existing SELECT policy should already cover this since opportunities are public
