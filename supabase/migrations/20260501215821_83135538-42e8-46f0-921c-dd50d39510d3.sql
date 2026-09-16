-- Fix overly-strict global unique constraint on credits.
-- Previously: UNIQUE (lower(url), lower(role)) globally — blocked any second user
-- from adding a credit for a shared event/release URL with the same role
-- (e.g., two DJs at the same gig, multiple producers on a track).
-- Now: scope uniqueness per user so a user can't double-add the same credit,
-- but different users can each claim their own role on a shared URL.

DROP INDEX IF EXISTS public.credits_unique_source_role;

CREATE UNIQUE INDEX credits_unique_user_source_role
  ON public.credits (user_id, lower(url), lower(role))
  WHERE url IS NOT NULL
    AND verification_status = ANY (ARRAY['verified'::text, 'pending'::text]);