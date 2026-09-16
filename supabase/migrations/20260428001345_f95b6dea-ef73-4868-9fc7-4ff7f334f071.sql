ALTER TABLE public.awards DROP CONSTRAINT IF EXISTS awards_verification_status_check;
ALTER TABLE public.awards ADD CONSTRAINT awards_verification_status_check
  CHECK (verification_status = ANY (ARRAY['unverified'::text,'pending'::text,'verified'::text,'imported'::text,'auto_discovered'::text,'rejected'::text]));

ALTER TABLE public.press_links DROP CONSTRAINT IF EXISTS press_links_verification_status_check;
ALTER TABLE public.press_links ADD CONSTRAINT press_links_verification_status_check
  CHECK (verification_status = ANY (ARRAY['unverified'::text,'pending'::text,'verified'::text,'imported'::text,'auto_discovered'::text,'rejected'::text]));