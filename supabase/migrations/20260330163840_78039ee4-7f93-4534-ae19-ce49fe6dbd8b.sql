
-- Allow writers to manage magazine articles
CREATE POLICY "Writers can manage magazine articles"
ON public.magazine_articles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'writer'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'writer'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
