
-- Fix SELECT policy to also allow admins to view applications
DROP POLICY "Users can view applications they created" ON public.applications;

CREATE POLICY "Users can view applications they created"
ON public.applications
FOR SELECT
USING (
  auth.uid() = applicant_id
  OR auth.uid() IN (
    SELECT opportunities.created_by
    FROM opportunities
    WHERE opportunities.id = applications.opportunity_id
  )
  OR public.has_role(auth.uid(), 'admin')
);
