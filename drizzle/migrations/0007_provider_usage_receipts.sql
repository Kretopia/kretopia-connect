CREATE TABLE public.ai_model_pricing (
 model text PRIMARY KEY,
 pricing jsonb NOT NULL,
 source text NOT NULL DEFAULT 'workspace gateway model catalog',
 fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_pricing TO service_role;
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ai_model_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 feature text NOT NULL,
 model text NOT NULL,
 gateway_request_id text,
 input_tokens bigint,
 output_tokens bigint,
 cached_input_tokens bigint,
 usage jsonb,
 pricing_snapshot jsonb,
 credits numeric(20,12),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','measured','usage_missing','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_calls TO service_role;
ALTER TABLE public.ai_model_calls ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_model_calls_owner_created ON public.ai_model_calls(user_id,created_at);
COMMENT ON TABLE public.ai_model_calls IS 'Provider usage receipts only; missing receipt has NULL credits, never a fixed estimate. Legacy requests without receipts remain unknown.';
CREATE OR REPLACE FUNCTION public.record_ai_model_usage(_call_id uuid, _usage jsonb, _input bigint, _output bigint, _cached bigint, _credits numeric, _pricing jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ai_model_calls%ROWTYPE; day_key text;
BEGIN
 SELECT * INTO c FROM public.ai_model_calls WHERE id=_call_id FOR UPDATE;
 IF NOT FOUND OR c.status='measured' THEN RETURN; END IF;
 IF _input<0 OR _output<0 OR _cached<0 OR _cached>_input OR _credits<0 THEN RAISE EXCEPTION 'Invalid provider usage'; END IF;
 day_key:=to_char(c.created_at AT TIME ZONE 'UTC','YYYYMMDD');
 UPDATE public.ai_model_calls SET input_tokens=_input, output_tokens=_output,cached_input_tokens=_cached, usage=_usage,pricing_snapshot=_pricing,credits=_credits,status='measured' WHERE id=_call_id;
 UPDATE public.ai_credit_ledger SET credits_used=credits_used+_credits,updated_at=now() WHERE user_id=c.user_id AND feature=c.feature AND window_key=day_key;
 UPDATE public.ai_credit_envelope SET credits_used=credits_used+_credits,updated_at=now() WHERE day=day_key;
END $$;
REVOKE ALL ON FUNCTION public.record_ai_model_usage(uuid,jsonb,bigint,bigint,bigint,numeric,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_model_usage(uuid,jsonb,bigint,bigint,bigint,numeric,jsonb) TO service_role;