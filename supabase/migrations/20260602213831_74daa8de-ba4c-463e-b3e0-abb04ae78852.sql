-- LOOKS
CREATE TABLE IF NOT EXISTS public.modeling_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_idx int NOT NULL DEFAULT 0,
  wardrobe jsonb DEFAULT '[]'::jsonb,
  reference_urls text[] DEFAULT '{}',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modeling_looks TO authenticated;
GRANT ALL ON public.modeling_looks TO service_role;
ALTER TABLE public.modeling_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage looks"
  ON public.modeling_looks FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_modeling_looks_project ON public.modeling_looks(project_id, order_idx);

-- CALL SHEETS
CREATE TABLE IF NOT EXISTS public.modeling_call_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shoot_date date,
  call_time time,
  wrap_time time,
  location jsonb,                -- {name,address,lat,lng,parking,notes}
  contacts jsonb DEFAULT '[]'::jsonb,  -- [{role,name,phone,email,user_id?}]
  weather_cache jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modeling_call_sheets TO authenticated;
GRANT ALL ON public.modeling_call_sheets TO service_role;
ALTER TABLE public.modeling_call_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage call sheets"
  ON public.modeling_call_sheets FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_modeling_call_sheets_project ON public.modeling_call_sheets(project_id);

-- USAGE RIGHTS
CREATE TABLE IF NOT EXISTS public.modeling_usage_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scope text NOT NULL,           -- editorial|commercial|social|ooh|broadcast|web
  territory text DEFAULT 'worldwide',
  duration_months int,
  exclusivity boolean DEFAULT false,
  rate_usd numeric(12,2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modeling_usage_rights TO authenticated;
GRANT ALL ON public.modeling_usage_rights TO service_role;
ALTER TABLE public.modeling_usage_rights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage usage rights"
  ON public.modeling_usage_rights FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_modeling_usage_rights_project ON public.modeling_usage_rights(project_id);

-- TIMESTAMP TRIGGERS
DO $$ BEGIN
  CREATE TRIGGER trg_modeling_looks_updated BEFORE UPDATE ON public.modeling_looks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_modeling_call_sheets_updated BEFORE UPDATE ON public.modeling_call_sheets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_modeling_usage_rights_updated BEFORE UPDATE ON public.modeling_usage_rights
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;