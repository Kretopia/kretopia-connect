
-- Canonical ICDB projects: the "encyclopedia" of creative works
CREATE TABLE public.icdb_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- film, album, single, festival, fashion_show, etc.
  category TEXT, -- maps to CATEGORY_GROUPS
  year INTEGER,
  description TEXT,
  platform TEXT, -- Netflix, Spotify, YouTube, etc.
  location TEXT,
  client_brand TEXT, -- label, studio, brand
  cover_image_url TEXT,
  external_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- flexible: genre, episode_count, featured_artists, etc.
  contributor_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for search
CREATE INDEX idx_icdb_projects_title ON public.icdb_projects USING gin(to_tsvector('english', title));
CREATE INDEX idx_icdb_projects_type ON public.icdb_projects(type);
CREATE INDEX idx_icdb_projects_category ON public.icdb_projects(category);
CREATE INDEX idx_icdb_projects_year ON public.icdb_projects(year);

-- Canonical roles on projects (who worked on what)
CREATE TABLE public.icdb_project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.icdb_projects(id) ON DELETE CASCADE NOT NULL,
  role_title TEXT NOT NULL, -- "Director", "Producer", "Featured Artist"
  person_name TEXT, -- name as credited
  claimed_by UUID, -- links to profiles.user_id if claimed
  is_claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_icdb_project_roles_project ON public.icdb_project_roles(project_id);
CREATE INDEX idx_icdb_project_roles_claimed ON public.icdb_project_roles(claimed_by);
CREATE INDEX idx_icdb_project_roles_name ON public.icdb_project_roles USING gin(to_tsvector('english', person_name));

-- ICDB companies/entities (labels, studios, agencies)
CREATE TABLE public.icdb_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT, -- label, studio, agency, brand, venue
  industry TEXT, -- music, film, fashion, etc.
  location TEXT,
  logo_url TEXT,
  website_url TEXT,
  description TEXT,
  project_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_icdb_companies_name ON public.icdb_companies USING gin(to_tsvector('english', name));

-- RLS policies - public read, admin write
ALTER TABLE public.icdb_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icdb_project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icdb_companies ENABLE ROW LEVEL SECURITY;

-- Anyone can read ICDB data (it's a public database)
CREATE POLICY "Anyone can read ICDB projects" ON public.icdb_projects FOR SELECT USING (true);
CREATE POLICY "Anyone can read ICDB roles" ON public.icdb_project_roles FOR SELECT USING (true);
CREATE POLICY "Anyone can read ICDB companies" ON public.icdb_companies FOR SELECT USING (true);

-- Authenticated users can claim roles
CREATE POLICY "Authenticated users can claim roles" ON public.icdb_project_roles 
  FOR UPDATE TO authenticated 
  USING (true) 
  WITH CHECK (claimed_by = auth.uid());

-- Admins can insert/update projects and companies
CREATE POLICY "Admins can manage ICDB projects" ON public.icdb_projects 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ICDB companies" ON public.icdb_companies 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can insert roles (for AI seeding)
CREATE POLICY "Service can insert ICDB roles" ON public.icdb_project_roles 
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_icdb_projects_updated_at 
  BEFORE UPDATE ON public.icdb_projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
