ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS site_sections JSONB DEFAULT '[{"id":"hero","label":"Hero","visible":true},{"id":"services","label":"Services","visible":true},{"id":"credits","label":"Work & Credits","visible":true},{"id":"testimonials","label":"Testimonials","visible":true},{"id":"contact","label":"Contact","visible":true}]'::jsonb,
ADD COLUMN IF NOT EXISTS site_headline TEXT,
ADD COLUMN IF NOT EXISTS site_bio TEXT;