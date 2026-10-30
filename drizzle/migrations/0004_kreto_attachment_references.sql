CREATE TABLE public.kreto_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 message_id uuid,
 conversation_id uuid,
 name text NOT NULL,
 mime text NOT NULL,
 object_path text NOT NULL UNIQUE,
 extracted_text text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
GRANT ALL ON public.kreto_attachments TO service_role;
ALTER TABLE public.kreto_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX kreto_attachments_owner_message ON public.kreto_attachments(owner_id, message_id);
CREATE INDEX kreto_attachments_expiry ON public.kreto_attachments(expires_at);
COMMENT ON TABLE public.kreto_attachments IS 'Private Cloud references for validated legacy owners; all reads/writes through authenticated edge handler. Original and extracted text expire 30 days after upload. No direct client policies.';
COMMENT ON COLUMN public.ai_credit_config.est_credits IS 'For __envelope__: this backend ledger ceiling only, not total spend or per-request average. Other rows are estimates, not measured invoices.';