-- Add quote support columns to invoices table
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS converted_from_quote_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '[]';

-- Index for fast filtering by document type
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON public.invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_converted_from ON public.invoices(converted_from_quote_id) WHERE converted_from_quote_id IS NOT NULL;