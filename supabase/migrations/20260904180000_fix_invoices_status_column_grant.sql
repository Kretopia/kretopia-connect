-- Warning flagged by the deep security scan: "Invoice issuers can mark
-- invoices as paid without real payment."
--
-- "The 'invoices' UPDATE policy ('Users can update their invoices') only
-- checks auth.uid() = issued_by with no WITH CHECK limiting which fields
-- can change. An issuer could set status='paid'/paid_at directly instead
-- of via the payment processor..."
--
-- A prior migration (20260812071205, section C7) already tried to close
-- exactly this: `REVOKE UPDATE (status, paid_at) ON public.invoices FROM
-- authenticated, anon` plus a properly-authorized
-- confirm_invoice_paid_manually() RPC to replace it. Same root cause as
-- every other privilege-drift finding this session (milestones,
-- profiles): a column-level REVOKE cannot override a coexisting
-- table-level GRANT, and no migration in this repo's tracked history
-- ever issues an explicit table-level GRANT for invoices -- meaning
-- `authenticated` has had table-level UPDATE from Supabase's
-- project-level default privileges the whole time, silently defeating
-- the column REVOKE. Confirmed live: an anon-key PATCH setting
-- status='paid' on invoices returns 200 (RLS-filtered to zero matching
-- rows for this anon test, not permission-denied) -- the exact "reaches
-- the row filter instead of being rejected at the grant layer" signature
-- already seen for milestones before its real fix.
--
-- Fix: table-level REVOKE UPDATE, then re-GRANT every column except
-- status/paid_at (dynamic exclusion list, matching the profiles/projects
-- precedent). Confirmed via grep: the only client-side invoices UPDATE
-- (src/components/project/InvoiceGenerator.tsx) never writes status or
-- paid_at -- its one status write ('accepted') has been failing against
-- the table's own CHECK constraint since it was written (that value was
-- never added to it), a pre-existing, unrelated bug this migration
-- neither causes nor fixes. confirm_invoice_paid_manually() already
-- exists, is issuer-only, requires a real payment-method note, and
-- rejects double-payment -- unaffected by a grantee-level REVOKE since
-- it's SECURITY DEFINER.

REVOKE UPDATE ON public.invoices FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name NOT IN ('status', 'paid_at')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.invoices TO authenticated', _col);
  END LOOP;
END $$;
