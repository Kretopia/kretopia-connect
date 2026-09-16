-- Create account type enum
CREATE TYPE public.account_type AS ENUM ('individual', 'company');

-- Add company-specific fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'individual',
ADD COLUMN company_name text,
ADD COLUMN company_logo_url text,
ADD COLUMN company_about text,
ADD COLUMN company_location_lat numeric,
ADD COLUMN company_location_lng numeric,
ADD COLUMN company_address text,
ADD COLUMN google_maps_place_id text,
ADD COLUMN company_size text,
ADD COLUMN company_industry text,
ADD COLUMN partner_location_id uuid REFERENCES public.partner_locations(id),
ADD COLUMN average_rating numeric DEFAULT 0,
ADD COLUMN total_reviews integer DEFAULT 0;

-- Create company reviews table
CREATE TABLE public.company_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  response_text text,
  response_date timestamp with time zone,
  status text NOT NULL DEFAULT 'published',
  helpful_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_reviewer_company UNIQUE (company_id, reviewer_id, project_id)
);

-- Enable RLS on company_reviews
ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_reviews
CREATE POLICY "Anyone can view published reviews"
ON public.company_reviews
FOR SELECT
USING (status = 'published');

CREATE POLICY "Users can create reviews for companies they worked with"
ON public.company_reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id 
  AND (
    -- Worked on a project together
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND (
        p.created_by = reviewer_id
        OR EXISTS (
          SELECT 1 FROM project_collaborators pc
          WHERE pc.project_id = p.id AND pc.user_id = reviewer_id AND pc.status = 'accepted'
        )
      )
    )
    OR
    -- Had an accepted application
    EXISTS (
      SELECT 1 FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.opportunity_id = opportunity_id
      AND a.applicant_id = reviewer_id
      AND a.status = 'accepted'
      AND o.created_by = company_id
    )
  )
);

CREATE POLICY "Companies can respond to their reviews"
ON public.company_reviews
FOR UPDATE
USING (
  auth.uid() = company_id
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = company_id AND account_type = 'company')
);

CREATE POLICY "Reviewers can update their own reviews"
ON public.company_reviews
FOR UPDATE
USING (auth.uid() = reviewer_id);

-- Trigger to update profile average rating
CREATE OR REPLACE FUNCTION update_company_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM company_reviews
      WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND status = 'published'
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM company_reviews
      WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND status = 'published'
    )
  WHERE user_id = COALESCE(NEW.company_id, OLD.company_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_rating_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.company_reviews
FOR EACH ROW
EXECUTE FUNCTION update_company_rating();

-- Add updated_at trigger for company_reviews
CREATE TRIGGER update_company_reviews_updated_at
BEFORE UPDATE ON public.company_reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();