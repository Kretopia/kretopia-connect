ALTER TABLE public.project_guest_links
  ADD COLUMN IF NOT EXISTS guest_role text NOT NULL DEFAULT 'viewer'
  CHECK (guest_role IN ('viewer','commenter','contributor'));