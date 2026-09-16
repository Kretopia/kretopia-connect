-- Add 'flagged' status to verification_requests status check constraint
ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'flagged'::text, 'approved'::text, 'rejected'::text, 'appealed'::text, 'appeal_approved'::text, 'appeal_rejected'::text]));