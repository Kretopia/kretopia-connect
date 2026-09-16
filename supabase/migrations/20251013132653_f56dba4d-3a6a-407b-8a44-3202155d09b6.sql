-- Make endorser_email optional in skill_endorsement_requests
ALTER TABLE public.skill_endorsement_requests
ALTER COLUMN endorser_email DROP NOT NULL;