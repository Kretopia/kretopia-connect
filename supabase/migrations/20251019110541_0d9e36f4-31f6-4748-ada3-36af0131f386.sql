-- Add missing authenticity_score column to verification_requests table
ALTER TABLE verification_requests 
ADD COLUMN IF NOT EXISTS authenticity_score INTEGER;

-- Add a comment to explain the column
COMMENT ON COLUMN verification_requests.authenticity_score IS 'AI-calculated authenticity score from 0-100 based on profile completeness and verification signals';