-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  issued_by UUID NOT NULL,
  issued_to UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  tax_rate NUMERIC DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount NUMERIC GENERATED ALWAYS AS (amount * tax_rate / 100) STORED,
  total_amount NUMERIC GENERATED ALWAYS AS (amount + (amount * tax_rate / 100)) STORED,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create payment_history table
CREATE TABLE public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  payment_intent_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('payment_received', 'payment_sent', 'refund', 'commission')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create project_templates table
CREATE TABLE public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_by UUID NOT NULL,
  is_public BOOLEAN DEFAULT false,
  structure JSONB NOT NULL,
  tasks JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb,
  estimated_duration TEXT,
  complexity TEXT CHECK (complexity IN ('beginner', 'intermediate', 'advanced')),
  usage_count INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create time_entries table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
      ELSE NULL
    END
  ) STORED,
  is_billable BOOLEAN DEFAULT true,
  hourly_rate NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices they're involved in"
  ON public.invoices FOR SELECT
  USING (
    auth.uid() = issued_by OR 
    auth.uid() = issued_to OR
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = invoices.project_id 
      AND user_has_project_access(p.id, auth.uid())
    )
  );

CREATE POLICY "Users can create invoices for their projects"
  ON public.invoices FOR INSERT
  WITH CHECK (
    auth.uid() = issued_by AND
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = invoices.project_id 
      AND user_has_project_access(p.id, auth.uid())
    )
  );

CREATE POLICY "Users can update their invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = issued_by);

-- RLS Policies for payment_history
CREATE POLICY "Users can view their payment history"
  ON public.payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for project_templates
CREATE POLICY "Anyone can view public templates"
  ON public.project_templates FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create templates"
  ON public.project_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their templates"
  ON public.project_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their templates"
  ON public.project_templates FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for time_entries
CREATE POLICY "Users can view time entries in their projects"
  ON public.time_entries FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = time_entries.project_id 
      AND user_has_project_access(p.id, auth.uid())
    )
  );

CREATE POLICY "Users can create time entries in their projects"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = time_entries.project_id 
      AND user_has_project_access(p.id, auth.uid())
    )
  );

CREATE POLICY "Users can update their time entries"
  ON public.time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their time entries"
  ON public.time_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  count_part INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO count_part
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  new_number := 'INV-' || year_part || '-' || LPAD(count_part::TEXT, 5, '0');
  
  RETURN new_number;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX idx_invoices_issued_by ON public.invoices(issued_by);
CREATE INDEX idx_invoices_issued_to ON public.invoices(issued_to);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX idx_payment_history_project_id ON public.payment_history(project_id);
CREATE INDEX idx_project_templates_category ON public.project_templates(category);
CREATE INDEX idx_project_templates_created_by ON public.project_templates(created_by);
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_task_id ON public.time_entries(task_id);