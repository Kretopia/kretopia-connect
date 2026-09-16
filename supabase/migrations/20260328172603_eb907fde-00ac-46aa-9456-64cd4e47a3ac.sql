
-- 1. Add universal ICDB Creator ID to profiles (THRIVE-XXXXXX format)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icdb_creator_id TEXT UNIQUE;

-- Function to generate ICDB Creator ID
CREATE OR REPLACE FUNCTION public.generate_icdb_creator_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := 'THRIVE-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE icdb_creator_id = new_id) INTO id_exists;
    EXIT WHEN NOT id_exists;
  END LOOP;
  RETURN new_id;
END;
$$;

-- Trigger: auto-assign ICDB ID on profile creation
CREATE OR REPLACE FUNCTION public.assign_icdb_creator_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.icdb_creator_id IS NULL THEN
    NEW.icdb_creator_id := generate_icdb_creator_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_icdb_creator_id_trigger ON profiles;
CREATE TRIGGER assign_icdb_creator_id_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_icdb_creator_id();

-- Backfill existing profiles
UPDATE profiles SET icdb_creator_id = generate_icdb_creator_id() WHERE icdb_creator_id IS NULL;

-- 2. Add industry_code to icdb_project_roles for standardized taxonomy
ALTER TABLE public.icdb_project_roles ADD COLUMN IF NOT EXISTS industry_code TEXT;
ALTER TABLE public.icdb_project_roles ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. Create brand verification table
CREATE TABLE IF NOT EXISTS public.icdb_brand_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.icdb_projects(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.icdb_project_roles(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_email TEXT NOT NULL,
  verification_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  submitted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.icdb_brand_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand verifications" ON public.icdb_brand_verifications
  FOR SELECT TO authenticated USING (submitted_by = auth.uid());

CREATE POLICY "Users can create brand verifications" ON public.icdb_brand_verifications
  FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Public token-based verification read" ON public.icdb_brand_verifications
  FOR SELECT TO anon USING (true);

-- 4. Create bulk project submissions table
CREATE TABLE IF NOT EXISTS public.icdb_bulk_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  projects_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.icdb_bulk_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own submissions" ON public.icdb_bulk_submissions
  FOR ALL TO authenticated USING (submitted_by = auth.uid()) WITH CHECK (submitted_by = auth.uid());

-- 5. Role taxonomy reference table
CREATE TABLE IF NOT EXISTS public.icdb_role_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  industry TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.icdb_role_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read taxonomy" ON public.icdb_role_taxonomy FOR SELECT USING (true);

-- Seed core taxonomy
INSERT INTO public.icdb_role_taxonomy (code, title, department, industry, aliases) VALUES
-- Film & TV
('FTV-DIR', 'Director', 'Direction', 'film_tv', ARRAY['Film Director', 'TV Director', 'Show Director']),
('FTV-PRD', 'Producer', 'Production', 'film_tv', ARRAY['Executive Producer', 'Line Producer', 'Co-Producer']),
('FTV-WRT', 'Screenwriter', 'Writing', 'film_tv', ARRAY['Writer', 'Script Writer', 'Teleplay Writer']),
('FTV-CIN', 'Cinematographer', 'Camera', 'film_tv', ARRAY['Director of Photography', 'DP', 'DOP', 'Camera Operator']),
('FTV-EDT', 'Editor', 'Post-Production', 'film_tv', ARRAY['Film Editor', 'Video Editor', 'Post Editor']),
('FTV-ACT', 'Actor', 'Cast', 'film_tv', ARRAY['Lead Actor', 'Supporting Actor', 'Featured Extra']),
('FTV-CLR', 'Colorist', 'Post-Production', 'film_tv', ARRAY['Color Grader', 'DI Colorist']),
('FTV-SND', 'Sound Designer', 'Sound', 'film_tv', ARRAY['Sound Editor', 'Audio Post', 'Sound Mixer']),
('FTV-VFX', 'VFX Artist', 'Visual Effects', 'film_tv', ARRAY['VFX Supervisor', 'Compositor', 'CGI Artist']),
('FTV-GAF', 'Gaffer', 'Lighting', 'film_tv', ARRAY['Chief Lighting Tech', 'Lighting Director']),
('FTV-GRP', 'Key Grip', 'Grip', 'film_tv', ARRAY['Grip', 'Best Boy Grip', 'Dolly Grip']),
('FTV-ART', 'Production Designer', 'Art', 'film_tv', ARRAY['Art Director', 'Set Designer']),
('FTV-CST', 'Casting Director', 'Casting', 'film_tv', ARRAY['Casting Associate', 'Casting Producer']),
('FTV-STY', 'Wardrobe Stylist', 'Wardrobe', 'film_tv', ARRAY['Costume Designer', 'Wardrobe Supervisor']),
('FTV-MUA', 'Makeup Artist', 'Hair & Makeup', 'film_tv', ARRAY['MUA', 'SFX Makeup', 'Key Makeup']),
-- Music
('MUS-ART', 'Recording Artist', 'Performance', 'music', ARRAY['Artist', 'Singer', 'Vocalist', 'Rapper', 'MC']),
('MUS-PRD', 'Music Producer', 'Production', 'music', ARRAY['Beat Maker', 'Track Producer', 'Record Producer']),
('MUS-ENG', 'Sound Engineer', 'Engineering', 'music', ARRAY['Mixing Engineer', 'Recording Engineer', 'Audio Engineer']),
('MUS-MIX', 'Mix Engineer', 'Engineering', 'music', ARRAY['Mixer', 'Mixing Artist']),
('MUS-MST', 'Mastering Engineer', 'Engineering', 'music', ARRAY['Mastering Artist']),
('MUS-SON', 'Songwriter', 'Writing', 'music', ARRAY['Lyricist', 'Topliner', 'Composer']),
('MUS-SES', 'Session Musician', 'Performance', 'music', ARRAY['Studio Musician', 'Session Player']),
('MUS-ARR', 'Arranger', 'Production', 'music', ARRAY['Musical Arranger', 'Orchestrator']),
('MUS-MGR', 'Music Manager', 'Management', 'music', ARRAY['Artist Manager', 'Band Manager']),
('MUS-A&R', 'A&R', 'Label', 'music', ARRAY['A&R Rep', 'A&R Director', 'Talent Scout']),
-- Fashion & Beauty
('FSH-DSG', 'Fashion Designer', 'Design', 'fashion', ARRAY['Apparel Designer', 'Clothing Designer']),
('FSH-STY', 'Fashion Stylist', 'Styling', 'fashion', ARRAY['Wardrobe Stylist', 'Personal Stylist', 'Editorial Stylist']),
('FSH-PHT', 'Fashion Photographer', 'Photography', 'fashion', ARRAY['Editorial Photographer', 'Lookbook Photographer']),
('FSH-MOD', 'Model', 'Cast', 'fashion', ARRAY['Fashion Model', 'Runway Model', 'Commercial Model']),
('FSH-MUA', 'Makeup Artist', 'Beauty', 'fashion', ARRAY['Beauty MUA', 'Fashion MUA', 'Glam Artist']),
('FSH-HRS', 'Hair Stylist', 'Beauty', 'fashion', ARRAY['Hairdresser', 'Hair Designer']),
('FSH-NAL', 'Nail Artist', 'Beauty', 'fashion', ARRAY['Nail Tech', 'Manicurist']),
-- Performing Arts
('PER-ACT', 'Theatre Actor', 'Performance', 'performing', ARRAY['Stage Actor', 'Thespian', 'Performer']),
('PER-DNC', 'Dancer', 'Performance', 'performing', ARRAY['Choreographer', 'Dance Captain']),
('PER-CHR', 'Choreographer', 'Direction', 'performing', ARRAY['Dance Director', 'Movement Director']),
('PER-PLW', 'Playwright', 'Writing', 'performing', ARRAY['Script Writer', 'Dramatist']),
('PER-STM', 'Stage Manager', 'Production', 'performing', ARRAY['SM', 'Production Stage Manager']),
('PER-COM', 'Comedian', 'Performance', 'performing', ARRAY['Stand-Up Comic', 'Sketch Performer']),
-- Events & Live
('EVT-PRD', 'Event Producer', 'Production', 'events', ARRAY['Show Producer', 'Festival Producer']),
('EVT-PRO', 'Promoter', 'Marketing', 'events', ARRAY['Event Promoter', 'Concert Promoter']),
('EVT-DJI', 'DJ', 'Performance', 'events', ARRAY['Disc Jockey', 'Club DJ', 'Festival DJ']),
('EVT-MC', 'MC / Host', 'Performance', 'events', ARRAY['Emcee', 'Event Host', 'Presenter']),
('EVT-SND', 'Live Sound Engineer', 'Technical', 'events', ARRAY['FOH Engineer', 'Monitor Engineer']),
('EVT-LIT', 'Lighting Designer', 'Technical', 'events', ARRAY['LD', 'Lighting Director']),
-- Digital & Content
('DIG-CCR', 'Content Creator', 'Creation', 'digital', ARRAY['Creator', 'Digital Creator', 'Influencer']),
('DIG-UGC', 'UGC Creator', 'Creation', 'digital', ARRAY['User Generated Content Creator']),
('DIG-VID', 'Videographer', 'Production', 'digital', ARRAY['Video Creator', 'Video Producer']),
('DIG-POD', 'Podcast Host', 'Creation', 'digital', ARRAY['Podcaster', 'Show Host']),
('DIG-SMM', 'Social Media Manager', 'Marketing', 'digital', ARRAY['Community Manager', 'Social Strategist']),
('DIG-CWR', 'Copywriter', 'Writing', 'digital', ARRAY['Content Writer', 'Brand Writer']),
-- Art & Design
('ART-GDS', 'Graphic Designer', 'Design', 'art', ARRAY['Visual Designer', 'Brand Designer']),
('ART-ILL', 'Illustrator', 'Art', 'art', ARRAY['Digital Illustrator', 'Comic Artist']),
('ART-ANM', 'Animator', 'Animation', 'art', ARRAY['Motion Designer', '2D Animator', '3D Animator']),
('ART-UXD', 'UX Designer', 'Design', 'art', ARRAY['UI/UX Designer', 'Product Designer', 'Interaction Designer']),
('ART-PHT', 'Photographer', 'Photography', 'art', ARRAY['Portrait Photographer', 'Commercial Photographer'])
ON CONFLICT (code) DO NOTHING;

-- Index for fast ICDB ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_icdb_creator_id ON profiles(icdb_creator_id);
CREATE INDEX IF NOT EXISTS idx_brand_verifications_token ON icdb_brand_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_industry ON icdb_role_taxonomy(industry);
