ALTER TABLE public.project_collaborators ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.project_collaborators
  ADD CONSTRAINT project_collaborators_user_or_email_check
  CHECK (user_id IS NOT NULL OR (email IS NOT NULL AND length(trim(email)) > 0));