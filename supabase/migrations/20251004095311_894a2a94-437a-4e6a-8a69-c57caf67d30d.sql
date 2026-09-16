-- Add personal message field to review requests
ALTER TABLE review_requests 
ADD COLUMN personal_message TEXT;

-- Add comment
COMMENT ON COLUMN review_requests.personal_message IS 'Optional personal message from the profile owner to the reviewer';