
-- Create contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'custom',
  terms_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates"
  ON public.contract_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create their own templates"
  ON public.contract_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own templates"
  ON public.contract_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON public.contract_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create project contracts table
CREATE TABLE public.project_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'custom',
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  party_a_user_id UUID NOT NULL,
  party_a_signed_at TIMESTAMPTZ,
  party_a_ip TEXT,
  party_b_user_id UUID,
  party_b_signed_at TIMESTAMPTZ,
  party_b_ip TEXT,
  contract_hash TEXT,
  blockchain_tx_hash TEXT,
  blockchain_network TEXT,
  blockchain_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  signed_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;

-- Users can view contracts for projects they have access to
CREATE POLICY "Users can view project contracts"
  ON public.project_contracts FOR SELECT
  TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

-- Users can create contracts for projects they have access to
CREATE POLICY "Users can create project contracts"
  ON public.project_contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
    AND created_by = auth.uid()
    AND party_a_user_id = auth.uid()
  );

-- Contract creator can update while in draft, both parties can sign
CREATE POLICY "Users can update project contracts"
  ON public.project_contracts FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
    AND (
      (created_by = auth.uid() AND status = 'draft')
      OR party_a_user_id = auth.uid()
      OR party_b_user_id = auth.uid()
    )
  );

-- Only creator can delete, and only drafts
CREATE POLICY "Creator can delete draft contracts"
  ON public.project_contracts FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'draft');

CREATE TRIGGER update_project_contracts_updated_at
  BEFORE UPDATE ON public.project_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast project lookups
CREATE INDEX idx_project_contracts_project_id ON public.project_contracts(project_id);
CREATE INDEX idx_project_contracts_status ON public.project_contracts(status);

-- Seed some default public contract templates
INSERT INTO public.contract_templates (created_by, title, description, contract_type, terms_template, is_public)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'Freelance Service Agreement', 'Standard agreement for freelance creative services including scope, deliverables, and payment terms.', 'service_agreement', 
   '{"sections": [{"title": "Scope of Work", "content": ""}, {"title": "Deliverables", "content": ""}, {"title": "Timeline", "content": ""}, {"title": "Payment Terms", "content": ""}, {"title": "Revisions", "content": "Up to 2 rounds of revisions included."}, {"title": "Ownership & Rights", "content": "Upon full payment, all rights transfer to the client."}, {"title": "Cancellation", "content": "Either party may cancel with 7 days written notice. Payment due for work completed."}]}'::jsonb, true),
  
  ('00000000-0000-0000-0000-000000000000', 'Non-Disclosure Agreement', 'Mutual NDA for protecting confidential information during creative collaborations.', 'nda',
   '{"sections": [{"title": "Definition of Confidential Information", "content": ""}, {"title": "Obligations", "content": "Both parties agree to keep all shared information confidential."}, {"title": "Duration", "content": "This agreement remains in effect for 2 years from the date of signing."}, {"title": "Exclusions", "content": "Information that is publicly available or independently developed is excluded."}, {"title": "Remedies", "content": ""}]}'::jsonb, true),
  
  ('00000000-0000-0000-0000-000000000000', 'Work-for-Hire Agreement', 'Agreement where all creative work produced belongs to the hiring party.', 'work_for_hire',
   '{"sections": [{"title": "Scope of Work", "content": ""}, {"title": "Work Product Ownership", "content": "All work created under this agreement is considered work-for-hire. All intellectual property rights belong to the hiring party."}, {"title": "Compensation", "content": ""}, {"title": "Timeline & Milestones", "content": ""}, {"title": "Representations", "content": "Creator represents that all work is original and does not infringe on third-party rights."}]}'::jsonb, true),
  
  ('00000000-0000-0000-0000-000000000000', 'Collaboration Agreement', 'Agreement for equal creative collaborations with shared ownership and revenue splitting.', 'collaboration',
   '{"sections": [{"title": "Project Description", "content": ""}, {"title": "Roles & Responsibilities", "content": ""}, {"title": "Ownership Split", "content": "50/50 unless otherwise specified."}, {"title": "Revenue Sharing", "content": "Revenue split matches ownership percentages."}, {"title": "Decision Making", "content": "Major decisions require mutual agreement."}, {"title": "Dispute Resolution", "content": ""}, {"title": "Exit Terms", "content": ""}]}'::jsonb, true);
