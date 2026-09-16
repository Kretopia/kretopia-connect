-- 1) Add scout/claim columns
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS scouted_by uuid,
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS original_source_text text;

-- Constrain claim_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creative_jams_claim_status_check'
  ) THEN
    ALTER TABLE public.creative_jams
      ADD CONSTRAINT creative_jams_claim_status_check
      CHECK (claim_status IN ('claimed', 'unclaimed'));
  END IF;
END $$;

-- Unique claim token (only when present)
CREATE UNIQUE INDEX IF NOT EXISTS creative_jams_claim_token_unique
  ON public.creative_jams (claim_token)
  WHERE claim_token IS NOT NULL;

-- Index for scout dashboards
CREATE INDEX IF NOT EXISTS creative_jams_scouted_by_idx
  ON public.creative_jams (scouted_by)
  WHERE scouted_by IS NOT NULL;

-- 2) Replace SELECT policies to hide unclaimed scouted events from the public
DROP POLICY IF EXISTS "Public events visible to everyone" ON public.creative_jams;
DROP POLICY IF EXISTS "Public jams visible to all authenticated users" ON public.creative_jams;

CREATE POLICY "Public claimed events visible to everyone"
ON public.creative_jams
FOR SELECT
USING (
  is_public = true
  AND claim_status = 'claimed'
);

CREATE POLICY "Authenticated users see their own + claimed public events"
ON public.creative_jams
FOR SELECT
TO authenticated
USING (
  (is_public = true AND claim_status = 'claimed')
  OR created_by = auth.uid()
  OR scouted_by = auth.uid()
);