
-- Fix review_requests table - make reviewer_name and reviewer_email nullable
-- These are provided by the reviewer when they submit, not the requester
ALTER TABLE public.review_requests 
  ALTER COLUMN reviewer_name DROP NOT NULL,
  ALTER COLUMN reviewer_email DROP NOT NULL;
