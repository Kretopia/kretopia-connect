-- Drop the FK constraint on credits table to allow unclaimed profile credits
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_user_id_fkey;

-- Also update the check constraint to include 'imported' status
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE credits ADD CONSTRAINT credits_verification_status_check 
  CHECK (verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'imported'::text]));

-- Do the same for awards table
ALTER TABLE awards DROP CONSTRAINT IF EXISTS awards_user_id_fkey;

-- Add 'imported' to awards verification status if exists
ALTER TABLE awards DROP CONSTRAINT IF EXISTS awards_verification_status_check;
ALTER TABLE awards ADD CONSTRAINT awards_verification_status_check 
  CHECK (verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'imported'::text]));