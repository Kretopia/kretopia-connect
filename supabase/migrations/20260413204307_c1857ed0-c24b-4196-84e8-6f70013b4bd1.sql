
CREATE TABLE public.client_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_name TEXT,
  page_url TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to insert errors
CREATE POLICY "Anyone can log errors"
ON public.client_error_logs
FOR INSERT
WITH CHECK (true);

-- No public read access - only viewable via admin/direct DB access
CREATE POLICY "No public read access"
ON public.client_error_logs
FOR SELECT
USING (false);

-- Index for querying recent errors
CREATE INDEX idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX idx_client_error_logs_user_id ON public.client_error_logs (user_id);
