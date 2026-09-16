-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  brand_color TEXT,
  logo_url TEXT,
  default_currency TEXT DEFAULT 'USD',
  default_markup_pct NUMERIC DEFAULT 0,
  payment_terms TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their clients"
ON public.clients FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id) WHERE archived_at IS NULL;

-- Client contacts (multiple people per client)
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage client contacts"
ON public.client_contacts FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = client_contacts.client_id AND c.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = client_contacts.client_id AND c.owner_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts(client_id);

-- Link projects to a client
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id) WHERE client_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();