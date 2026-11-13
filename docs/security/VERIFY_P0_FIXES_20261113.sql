-- READ-ONLY: changes nothing, and never raises an error whatever has or has not been applied. Run it on the production
-- (legacy) database before the migrations below (each line about them should say NOT APPLIED, and no line PROBLEM), and
-- again after (APPLIED, OK or INFO). One query on purpose: the SQL editor shows only the result of the last statement.
--
-- Migrations it covers (docs/security-compliance/p0-fixes-2026-11-13.md):
--   supabase/migrations/20261015100000_invoices_provider_reference.sql   (needs 20260904180000, checked below)
--   supabase/migrations/20261113100000_wallets_client_insert_starts_empty.sql
--   supabase/migrations/20261113101000_messages_receiver_updates_read_state_only.sql
--   supabase/migrations/20261113102000_start_video_call_requires_approval.sql
-- and the Stripe event ledger the webhooks write (no migration: this only reads its state).
--
-- Statuses: APPLIED / OK = as intended. NOT APPLIED = the change is not there yet. PROBLEM = something is wrong and needs
-- action before or after applying (the detail says what). INFO = a number or a definition, not a verdict.

WITH
t AS (
  SELECT to_regclass('public.wallets') AS wallets,
         to_regclass('public.messages') AS messages,
         to_regclass('public.invoices') AS invoices,
         to_regclass('public.orch_tool_registry') AS registry,
         to_regclass('public.orch_actions') AS actions,
         to_regclass('public.stripe_webhook_events') AS ledger
),
cols AS (
  SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('wallets', 'messages', 'invoices', 'orch_actions', 'stripe_webhook_events')
),
trg AS (
  SELECT c.relname AS table_name, g.tgname
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace AND NOT g.tgisinternal
),
reg AS (
  -- One row per tool, always: read through query_to_xml only when the registry exists, so this cannot raise.
  SELECT tool AS tool_name,
         CASE WHEN (SELECT registry FROM t) IS NULL THEN NULL ELSE
           (xpath('/row/r/text()', query_to_xml(
              format('SELECT coalesce(max(risk_level::text), ''missing'') AS r FROM public.orch_tool_registry WHERE tool_name = %L', tool),
              false, true, '')))[1]::text END AS risk_level
    FROM unnest(ARRAY['start_video_call', 'send_message_to_collaborator']) AS tool
),
n AS (
  -- Counts read through query_to_xml only when the table exists, so a missing table reads as NULL instead of an error.
  SELECT
    CASE WHEN (SELECT ledger FROM t) IS NULL THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.stripe_webhook_events', false, true, '')))[1]::text END AS ledger_rows,
    CASE WHEN (SELECT wallets FROM t) IS NULL THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.wallets', false, true, '')))[1]::text END AS wallets_total,
    CASE WHEN (SELECT wallets FROM t) IS NULL THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.wallets w WHERE (to_jsonb(w) ->> ''balance'')::numeric > 0', false, true, '')))[1]::text END AS wallets_with_balance,
    CASE WHEN (SELECT invoices FROM t) IS NULL THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.invoices i WHERE (to_jsonb(i) ->> ''status'') = ''paid''', false, true, '')))[1]::text END AS invoices_paid,
    CASE WHEN (SELECT invoices FROM t) IS NULL THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.invoices i WHERE (to_jsonb(i) ->> ''status'') = ''paid'' AND coalesce(to_jsonb(i) ->> ''stripe_payment_intent_id'', '''') <> ''''', false, true, '')))[1]::text END AS invoices_paid_with_reference,
    CASE WHEN (SELECT actions FROM t) IS NULL OR NOT EXISTS (SELECT 1 FROM cols WHERE table_name = 'orch_actions' AND column_name = 'source') THEN NULL ELSE
      (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.orch_actions a WHERE a.source = ''desk_agent'' AND a.proposed_at > now() - interval ''7 days''', false, true, '')))[1]::text END AS desk_actions_7d
)
SELECT nr, check_name, status, detail
FROM (
  -- Wallets ----------------------------------------------------------------------------------------------------------------
  SELECT 1 AS nr,
         'Wallets: a wallet created through the API starts empty' AS check_name,
         CASE WHEN EXISTS (SELECT 1 FROM trg WHERE table_name = 'wallets' AND tgname = 'trg_wallets_client_insert_starts_empty')
              THEN 'APPLIED' ELSE 'NOT APPLIED' END AS status,
         '20261113100000: balance 0, credits at most the 10 welcome credits, currency USD for anon/authenticated inserts' AS detail
  UNION ALL
  SELECT 2,
         'Wallets: the columns the trigger sets exist',
         CASE WHEN (SELECT count(*) FROM cols WHERE table_name = 'wallets'
                     AND column_name IN ('balance', 'credits', 'currency', 'created_at', 'updated_at')) = 5 THEN 'OK' ELSE 'PROBLEM' END,
         'PROBLEM means production''s wallets table differs from the repository: do not apply 20261113100000 until it is adapted. Found: '
         || coalesce((SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM cols WHERE table_name = 'wallets'), 'no wallets table')
  UNION ALL
  SELECT 3,
         'Wallets: API roles cannot update or delete a wallet',
         CASE WHEN (SELECT wallets FROM t) IS NULL THEN 'PROBLEM'
              WHEN has_table_privilege('authenticated', 'public.wallets', 'UPDATE') OR has_table_privilege('authenticated', 'public.wallets', 'DELETE')
                OR has_table_privilege('anon', 'public.wallets', 'UPDATE') OR has_table_privilege('anon', 'public.wallets', 'DELETE') THEN 'PROBLEM'
              ELSE 'OK' END,
         'expected since 20260823223419; PROBLEM means a balance can still be edited from the browser'
  UNION ALL
  SELECT 4,
         'Wallets: INSERT policies (the gap 20261113100000 closes)',
         'INFO',
         coalesce((SELECT string_agg(policyname || ' WITH CHECK ' || coalesce(with_check, '(none)'), ' | ')
                     FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallets' AND cmd IN ('INSERT', 'ALL')), 'no INSERT policy')
  UNION ALL
  SELECT 5,
         'Wallets: how many, and how many hold a balance',
         'INFO',
         coalesce((SELECT wallets_total FROM n), '?') || ' wallets, ' || coalesce((SELECT wallets_with_balance FROM n), '?')
         || ' with a balance above 0 (a balance can be legitimate: reconcile against top-ups and transfers before concluding anything)'
  UNION ALL
  -- Messages ---------------------------------------------------------------------------------------------------------------
  SELECT 6,
         'Messages: the receiver may change the read state only',
         CASE WHEN NOT EXISTS (SELECT 1 FROM trg WHERE table_name = 'messages' AND tgname = 'trg_messages_receiver_updates_read_state_only') THEN 'NOT APPLIED'
              WHEN has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN 'PROBLEM'
              ELSE 'APPLIED' END,
         '20261113101000. PROBLEM: the trigger is there but a table-wide UPDATE grant came back (the trigger still refuses other columns)'
  UNION ALL
  SELECT 7,
         'Messages: the read column exists and stays writable',
         CASE WHEN NOT EXISTS (SELECT 1 FROM cols WHERE table_name = 'messages' AND column_name = 'read') THEN 'PROBLEM'
              WHEN has_column_privilege('authenticated', 'public.messages', 'read', 'UPDATE') THEN 'OK'
              ELSE 'PROBLEM' END,
         'PROBLEM before applying: production has no messages.read (adapt the migration). PROBLEM after: conversations cannot be marked read'
  UNION ALL
  SELECT 8,
         'Messages: UPDATE policies',
         'INFO',
         coalesce((SELECT string_agg(policyname || ' USING ' || coalesce(qual, '(none)') || ' WITH CHECK ' || coalesce(with_check, '(none)'), ' | ')
                     FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND cmd IN ('UPDATE', 'ALL')), 'no UPDATE policy')
  UNION ALL
  -- Desk agent -------------------------------------------------------------------------------------------------------------
  SELECT 9,
         'Agent registry: start_video_call needs approval',
         CASE WHEN coalesce((SELECT risk_level FROM reg WHERE tool_name = 'start_video_call'), 'missing') = 'missing' THEN 'PROBLEM'
              WHEN (SELECT risk_level FROM reg WHERE tool_name = 'start_video_call') = 'requires_approval' THEN 'APPLIED'
              ELSE 'NOT APPLIED' END,
         '20261113102000. PROBLEM: the tool is not registered, so the orchestrator cannot run or propose it'
  UNION ALL
  SELECT 10,
         'Agent registry: send_message_to_collaborator needs approval',
         CASE WHEN (SELECT risk_level FROM reg WHERE tool_name = 'send_message_to_collaborator') = 'requires_approval' THEN 'OK' ELSE 'PROBLEM' END,
         'expected since 20260504203621'
  UNION ALL
  SELECT 11,
         'Agent ledger: desk-agent can record what it ran',
         CASE WHEN (SELECT actions FROM t) IS NULL THEN 'PROBLEM'
              WHEN NOT EXISTS (SELECT 1 FROM cols WHERE table_name = 'orch_actions' AND column_name = 'source') THEN 'PROBLEM'
              WHEN NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type ty ON ty.oid = e.enumtypid WHERE ty.typname = 'orch_action_status' AND e.enumlabel = 'auto_executed') THEN 'PROBLEM'
              WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = (SELECT actions FROM t) AND contype = 'c'
                             AND pg_get_constraintdef(oid) LIKE '%source%' AND pg_get_constraintdef(oid) NOT LIKE '%desk_agent%') THEN 'PROBLEM'
              ELSE 'OK' END,
         'orch_actions.source accepts desk_agent and the status auto_executed exists (20260915100000). PROBLEM: deploying desk-agent would log ledger write failures'
  UNION ALL
  SELECT 12,
         'Agent ledger: desk-agent actions in the last 7 days',
         'INFO',
         coalesce((SELECT desk_actions_7d FROM n), 'n/a') || ' (after the deploy, every Desk tool run and every queued message or call appears here)'
  UNION ALL
  -- Payments ---------------------------------------------------------------------------------------------------------------
  SELECT 13,
         'Invoices: clients may update only the columns granted to them (20260904180000)',
         CASE WHEN (SELECT invoices FROM t) IS NULL THEN 'PROBLEM'
              WHEN has_table_privilege('authenticated', 'public.invoices', 'UPDATE') OR has_table_privilege('anon', 'public.invoices', 'UPDATE') THEN 'PROBLEM'
              ELSE 'OK' END,
         'PROBLEM: a table-wide UPDATE grant is in place, so a client can set status = paid itself, and the column revoke in 20261015100000 '
         || 'would not hold. Apply 20260904180000_fix_invoices_status_column_grant.sql first'
  UNION ALL
  SELECT 14,
         'Invoices: provider reference column',
         CASE WHEN EXISTS (SELECT 1 FROM cols WHERE table_name = 'invoices' AND column_name = 'stripe_payment_intent_id') THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         '20261015100000. Until applied, the marketplace webhook cannot mark an invoice paid (its update names this column) and every paid invoice reads as recorded by the issuer'
  UNION ALL
  SELECT 15,
         'Invoices: a client cannot insert an invoice that is already paid',
         CASE WHEN EXISTS (SELECT 1 FROM trg WHERE table_name = 'invoices' AND tgname = 'trg_invoices_block_client_paid_insert') THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         '20261015100000'
  UNION ALL
  SELECT 16,
         'Invoices: clients cannot write the provider reference',
         CASE WHEN NOT EXISTS (SELECT 1 FROM cols WHERE table_name = 'invoices' AND column_name = 'stripe_payment_intent_id') THEN 'NOT APPLIED'
              WHEN has_column_privilege('authenticated', 'public.invoices', 'stripe_payment_intent_id', 'UPDATE')
                OR has_column_privilege('anon', 'public.invoices', 'stripe_payment_intent_id', 'UPDATE') THEN 'PROBLEM'
              ELSE 'OK' END,
         'PROBLEM: an issuer could make a self-recorded payment look provider-confirmed'
  UNION ALL
  SELECT 17,
         'Invoices: paid, and paid with a provider reference',
         'INFO',
         coalesce((SELECT invoices_paid FROM n), '?') || ' paid, ' || coalesce((SELECT invoices_paid_with_reference FROM n), '?') || ' with a provider reference'
  UNION ALL
  -- Stripe event ledger ----------------------------------------------------------------------------------------------------
  SELECT 18,
         'Stripe ledger: the table exists',
         CASE WHEN (SELECT ledger FROM t) IS NULL THEN 'PROBLEM' ELSE 'OK' END,
         'PROBLEM: every event is processed without duplicate protection; the webhooks log STRIPE EVENT LEDGER CANNOT BE WRITTEN'
  UNION ALL
  SELECT 19,
         'Stripe ledger: the columns the webhooks write exist',
         CASE WHEN (SELECT count(*) FROM cols WHERE table_name = 'stripe_webhook_events' AND column_name IN ('event_id', 'type', 'payload')) = 3 THEN 'OK' ELSE 'PROBLEM' END,
         'event_id, type, payload. Found: ' || coalesce((SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM cols WHERE table_name = 'stripe_webhook_events'), 'no table')
  UNION ALL
  SELECT 20,
         'Stripe ledger: a redelivered event is recognised (event_id is unique)',
         CASE WHEN (SELECT ledger FROM t) IS NULL THEN 'PROBLEM'
              WHEN EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
                            WHERE i.indrelid = (SELECT ledger FROM t) AND i.indisunique AND i.indnatts = 1 AND a.attname = 'event_id') THEN 'OK'
              ELSE 'PROBLEM' END,
         'PROBLEM: a second delivery of the same event is processed again'
  UNION ALL
  SELECT 21,
         'Stripe ledger: the webhooks (service role) can claim and give back events',
         CASE WHEN (SELECT ledger FROM t) IS NULL OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'PROBLEM'
              WHEN has_table_privilege('service_role', 'public.stripe_webhook_events', 'INSERT')
               AND has_table_privilege('service_role', 'public.stripe_webhook_events', 'DELETE') THEN 'OK'
              ELSE 'PROBLEM' END,
         'INSERT claims an event, DELETE gives it back after a failure so Stripe''s retry is processed'
  UNION ALL
  SELECT 22,
         'Stripe ledger: rows recorded',
         'INFO',
         coalesce((SELECT ledger_rows FROM n), 'no table')
         || ' (0 while Stripe has delivered events means the inserts fail: read the webhook logs for "STRIPE EVENT LEDGER CANNOT BE WRITTEN")'
) checks
ORDER BY nr;
