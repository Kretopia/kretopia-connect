-- First, add appeal columns
ALTER TABLE public.verification_requests
ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS appeal_reason TEXT,
ADD COLUMN IF NOT EXISTS appeal_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS appeal_reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS appeal_decision TEXT;

-- Update any invalid status values to 'pending'
UPDATE public.verification_requests
SET status = 'pending'
WHERE status NOT IN ('pending', 'approved', 'rejected', 'appealed', 'appeal_approved', 'appeal_rejected');

-- Now drop and recreate the constraint
ALTER TABLE public.verification_requests 
DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE public.verification_requests
ADD CONSTRAINT verification_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'appealed', 'appeal_approved', 'appeal_rejected'));