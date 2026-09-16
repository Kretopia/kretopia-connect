
-- Add slug column to magazine_articles
ALTER TABLE public.magazine_articles ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Generate slugs for existing articles
UPDATE public.magazine_articles 
SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Add RLS policy for public read access to published articles
CREATE POLICY "Anyone can view published articles" 
ON public.magazine_articles FOR SELECT 
USING (is_published = true);
