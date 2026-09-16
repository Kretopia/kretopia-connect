
-- Ensure grants are properly applied to the view
GRANT SELECT ON public.skill_endorsement_counts TO anon;
GRANT SELECT ON public.skill_endorsement_counts TO authenticated;
GRANT SELECT ON public.skill_endorsement_counts TO public;
