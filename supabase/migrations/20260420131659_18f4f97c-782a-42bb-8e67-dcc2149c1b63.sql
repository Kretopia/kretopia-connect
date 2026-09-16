-- Allow admin and writer to update any magazine article
DROP POLICY IF EXISTS "Authors can update own articles" ON public.magazine_articles;
DROP POLICY IF EXISTS "Authors can delete own articles" ON public.magazine_articles;
DROP POLICY IF EXISTS "Authenticated users can create their own articles" ON public.magazine_articles;

CREATE POLICY "Authors, admin and writer can update articles"
ON public.magazine_articles
FOR UPDATE
TO authenticated
USING (
  author_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'writer')
);

CREATE POLICY "Authors, admin and writer can delete articles"
ON public.magazine_articles
FOR DELETE
TO authenticated
USING (
  author_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'writer')
);

-- Only admin and writer can publish new articles
CREATE POLICY "Admin and writer can create articles"
ON public.magazine_articles
FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'writer')
  )
);