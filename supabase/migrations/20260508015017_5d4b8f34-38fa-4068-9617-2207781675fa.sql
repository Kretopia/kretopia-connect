
CREATE TABLE public.event_seating_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Main Layout',
  tables JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_seating_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  layout_id UUID NOT NULL REFERENCES public.event_seating_layouts(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  seat_index INT,
  user_id UUID,
  guest_email TEXT,
  guest_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (layout_id, table_id, seat_index)
);

CREATE INDEX idx_seating_assignments_event ON public.event_seating_assignments(event_id);
CREATE INDEX idx_seating_assignments_layout ON public.event_seating_assignments(layout_id);
CREATE INDEX idx_seating_layouts_event ON public.event_seating_layouts(event_id);

ALTER TABLE public.event_seating_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_seating_assignments ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a host/collaborator on the event's project?
CREATE OR REPLACE FUNCTION public.is_event_host(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.event_id = _event_id
      AND (
        p.created_by = _user_id
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators pc
          WHERE pc.project_id = p.id AND pc.user_id = _user_id AND pc.status = 'accepted'
        )
      )
  );
$$;

-- Layouts: hosts manage; everyone with an RSVP can view
CREATE POLICY "Hosts manage seating layouts"
ON public.event_seating_layouts
FOR ALL
USING (public.is_event_host(event_id, auth.uid()))
WITH CHECK (public.is_event_host(event_id, auth.uid()));

CREATE POLICY "RSVP'd guests can view layouts"
ON public.event_seating_layouts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jam_participants jp
    WHERE jp.jam_id = event_id AND jp.user_id = auth.uid()
  )
);

-- Assignments: hosts manage; guests see only their own row
CREATE POLICY "Hosts manage seat assignments"
ON public.event_seating_assignments
FOR ALL
USING (public.is_event_host(event_id, auth.uid()))
WITH CHECK (public.is_event_host(event_id, auth.uid()));

CREATE POLICY "Guests can view their own assignment"
ON public.event_seating_assignments
FOR SELECT
USING (user_id = auth.uid());

CREATE TRIGGER update_event_seating_layouts_updated_at
BEFORE UPDATE ON public.event_seating_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
