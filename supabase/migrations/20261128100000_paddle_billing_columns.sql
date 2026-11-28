-- Paddle Billing (subscriptions only). Additive and idempotent: no existing column, row or policy changes.
-- NOT applied to the legacy production backend from the repo; it is applied by pasting it there (see docs/platform/DEPLOYMENT_RUNBOOK.md).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_provider text,
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  -- occurred_at of the last Paddle event applied: an older event arriving later is ignored.
  ADD COLUMN IF NOT EXISTS subscription_event_at timestamptz;

-- Billing state is written by verified webhooks only (same rule as subscription_tier, see 20260904150000): never client-writable.
REVOKE UPDATE (subscription_provider, paddle_customer_id, paddle_subscription_id, subscription_event_at) ON public.profiles FROM authenticated, anon;
REVOKE INSERT (subscription_provider, paddle_customer_id, paddle_subscription_id, subscription_event_at) ON public.profiles FROM authenticated, anon;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_provider_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_provider_check
  CHECK (subscription_provider IS NULL OR subscription_provider IN ('stripe', 'paddle'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_paddle_subscription_id_key
  ON public.profiles (paddle_subscription_id) WHERE paddle_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_paddle_customer_id_idx
  ON public.profiles (paddle_customer_id) WHERE paddle_customer_id IS NOT NULL;

-- Event ledger: the id is claimed before an event is processed, so a redelivery is answered 200 and not applied twice.
CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  event_id text PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_anon_authenticated" ON public.paddle_webhook_events;
CREATE POLICY "deny_all_anon_authenticated" ON public.paddle_webhook_events
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
GRANT ALL ON public.paddle_webhook_events TO service_role;
