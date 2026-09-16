-- Event Suppliers (vendors)
CREATE TABLE IF NOT EXISTS public.event_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  fee_amount numeric(12,2),
  fee_currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'lead',
  notes text,
  linked_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage suppliers" ON public.event_suppliers
  FOR ALL USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX idx_event_suppliers_project ON public.event_suppliers(project_id, status);
CREATE TRIGGER trg_event_suppliers_updated BEFORE UPDATE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Event Talent (performers, speakers, crew)
CREATE TABLE IF NOT EXISTS public.event_talent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  role text NOT NULL DEFAULT 'performer',
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  fee_amount numeric(12,2),
  fee_currency text DEFAULT 'USD',
  call_time timestamptz,
  status text NOT NULL DEFAULT 'invited',
  notes text,
  linked_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_talent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage talent" ON public.event_talent
  FOR ALL USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX idx_event_talent_project ON public.event_talent(project_id, status);
CREATE TRIGGER trg_event_talent_updated BEFORE UPDATE ON public.event_talent
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();