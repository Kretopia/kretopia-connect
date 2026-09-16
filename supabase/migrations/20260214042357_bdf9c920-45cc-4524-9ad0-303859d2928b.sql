-- Allow opportunity owners to view profiles of applicants who applied to their opportunities
CREATE POLICY "Opportunity owners can view applicant profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT a.applicant_id
    FROM applications a
    JOIN opportunities o ON o.id = a.opportunity_id
    WHERE o.created_by = auth.uid()
  )
);

-- Also allow users to view profiles of opportunity creators (so applicants can see who posted)
CREATE POLICY "Users can view opportunity creator profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT DISTINCT o.created_by
    FROM opportunities o
    WHERE o.status = 'active' AND o.created_by IS NOT NULL
  )
);