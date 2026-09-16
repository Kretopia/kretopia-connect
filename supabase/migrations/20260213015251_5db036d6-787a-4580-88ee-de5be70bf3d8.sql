
-- Add guest posting support to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_company_name text,
  ADD COLUMN IF NOT EXISTS guest_logo_url text,
  ADD COLUMN IF NOT EXISTS is_guest_post boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_profile_id uuid;

-- Allow anon users to INSERT guest opportunities (they must provide email for verification)
CREATE POLICY "Anyone can create guest opportunities"
  ON public.opportunities
  FOR INSERT
  TO anon
  WITH CHECK (is_guest_post = true AND guest_email IS NOT NULL);

-- Allow the verify edge function (via service role) to update guest posts
-- Already covered by service role bypassing RLS

-- Allow public to read active, verified opportunities (including guest posts)
-- Check if a broad SELECT policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'opportunities' 
    AND policyname = 'Anyone can view active opportunities'
  ) THEN
    CREATE POLICY "Anyone can view active opportunities"
      ON public.opportunities
      FOR SELECT
      TO anon, authenticated
      USING (status = 'active' AND (is_guest_post = false OR verified_at IS NOT NULL));
  END IF;
END $$;
