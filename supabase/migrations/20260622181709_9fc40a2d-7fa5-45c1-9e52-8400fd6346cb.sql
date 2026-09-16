-- Phase 1.b: explicit deny policies for service-role-only tables
-- These tables already had RLS enabled with zero policies (default-deny).
-- Adding explicit deny policies makes intent explicit and clears security lints.

-- Helper: drop any same-named policy first so migration is idempotent.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'stripe_webhook_events',
    'guest_wallets',
    'guest_wallet_topups',
    'guest_wallet_transactions',
    'guest_wallet_sessions',
    'telegram_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "deny_all_anon_authenticated" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "deny_all_anon_authenticated" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- Ensure service_role retains full access (defense in depth).
GRANT ALL ON public.stripe_webhook_events TO service_role;
GRANT ALL ON public.guest_wallets TO service_role;
GRANT ALL ON public.guest_wallet_topups TO service_role;
GRANT ALL ON public.guest_wallet_transactions TO service_role;
GRANT ALL ON public.guest_wallet_sessions TO service_role;
GRANT ALL ON public.telegram_messages TO service_role;