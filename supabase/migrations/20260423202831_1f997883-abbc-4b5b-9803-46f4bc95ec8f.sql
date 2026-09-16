
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS agent_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_user_id uuid,
  ADD COLUMN IF NOT EXISTS client_user_id uuid,
  ADD COLUMN IF NOT EXISTS creative_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS client_price numeric,
  ADD COLUMN IF NOT EXISTS creative_payout numeric,
  ADD COLUMN IF NOT EXISTS margin_type text,
  ADD COLUMN IF NOT EXISTS margin_value numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

UPDATE public.projects
  SET setup_completed = true
  WHERE setup_completed IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_type ON public.projects(workspace_type);
CREATE INDEX IF NOT EXISTS idx_projects_deal_type ON public.projects(deal_type);
CREATE INDEX IF NOT EXISTS idx_projects_agent_user ON public.projects(agent_user_id) WHERE agent_user_id IS NOT NULL;

ALTER TABLE public.project_collaborators
  ADD COLUMN IF NOT EXISTS agent_role text;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND p.created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = _project_id AND pc.user_id = _user_id
  );
$$;

CREATE TABLE IF NOT EXISTS public.project_call_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  shoot_date date,
  call_time time,
  wrap_time time,
  location_name text,
  location_address text,
  weather_note text,
  parking_note text,
  contact_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_call_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view call sheets" ON public.project_call_sheets FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create call sheets" ON public.project_call_sheets FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update call sheets" ON public.project_call_sheets FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete call sheets" ON public.project_call_sheets FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_call_sheets_project ON public.project_call_sheets(project_id);

CREATE TABLE IF NOT EXISTS public.project_run_of_show (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  time_slot time,
  duration_min integer,
  segment_title text NOT NULL,
  owner_id uuid,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_run_of_show ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view ROS" ON public.project_run_of_show FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create ROS" ON public.project_run_of_show FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update ROS" ON public.project_run_of_show FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete ROS" ON public.project_run_of_show FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ros_project ON public.project_run_of_show(project_id);

CREATE TABLE IF NOT EXISTS public.project_roll_call (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  person_user_id uuid,
  person_name text NOT NULL,
  person_role text,
  person_contact text,
  status text NOT NULL DEFAULT 'invited',
  arrived_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_roll_call ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view roll call" ON public.project_roll_call FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create roll call" ON public.project_roll_call FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update roll call" ON public.project_roll_call FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete roll call" ON public.project_roll_call FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_roll_call_project ON public.project_roll_call(project_id);

CREATE TABLE IF NOT EXISTS public.project_exchange_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  what_i_give text,
  what_i_get text,
  estimated_value numeric,
  currency text DEFAULT 'USD',
  proof_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivered boolean NOT NULL DEFAULT false,
  received boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_exchange_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view exchange" ON public.project_exchange_terms FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create exchange" ON public.project_exchange_terms FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update exchange" ON public.project_exchange_terms FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete exchange" ON public.project_exchange_terms FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_exchange_project ON public.project_exchange_terms(project_id);

CREATE TABLE IF NOT EXISTS public.project_split_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  contributor_user_id uuid,
  contributor_name text NOT NULL,
  contributor_role text,
  percentage numeric NOT NULL DEFAULT 0,
  publisher text,
  pro_affiliation text,
  notes text,
  signed boolean NOT NULL DEFAULT false,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_split_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view splits" ON public.project_split_sheets FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create splits" ON public.project_split_sheets FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update splits" ON public.project_split_sheets FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete splits" ON public.project_split_sheets FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_splits_project ON public.project_split_sheets(project_id);

CREATE TABLE IF NOT EXISTS public.project_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  title text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view revisions" ON public.project_revisions FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create revisions" ON public.project_revisions FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND requested_by = auth.uid());
CREATE POLICY "Members update revisions" ON public.project_revisions FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete revisions" ON public.project_revisions FOR DELETE USING (public.is_project_member(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_revisions_project ON public.project_revisions(project_id);

CREATE TABLE IF NOT EXISTS public.project_setup_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_setup_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view setup" ON public.project_setup_state FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create setup" ON public.project_setup_state FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members update setup" ON public.project_setup_state FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete setup" ON public.project_setup_state FOR DELETE USING (public.is_project_member(project_id, auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_call_sheets','project_run_of_show','project_roll_call',
    'project_exchange_terms','project_split_sheets','project_revisions','project_setup_state'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;
