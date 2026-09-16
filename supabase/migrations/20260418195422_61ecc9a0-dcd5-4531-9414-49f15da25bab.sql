ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN (
    'unverified', 'verified', 'pending', 'pending_review', 'rejected', 'auto_discovered', 'disputed'
  ));