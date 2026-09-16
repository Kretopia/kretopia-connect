
-- Drop the existing update policy
DROP POLICY "Opportunity creators can update applications" ON public.applications;

-- Create updated policy that also allows admins to update applications
CREATE POLICY "Opportunity creators can update applications"
ON public.applications
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT opportunities.created_by
    FROM opportunities
    WHERE opportunities.id = applications.opportunity_id
  )
  OR public.has_role(auth.uid(), 'admin')
);
