-- wallets: a wallet created through the API starts empty.
--
-- READ BEFORE APPLYING. Not applied by anyone: this file is a reviewed proposal in a PR.
-- Check production first with the read-only queries in
-- docs/security-compliance/p0-fixes-2026-11-13.md (section "Wallets").
--
-- Why
--   * The INSERT policy "Users can insert their own wallet" (20250930110718) checks only
--     user_id = auth.uid(). A signed-in member without a wallet row could therefore create one
--     with any balance and any credits in a single request.
--   * UPDATE and DELETE are already closed for the API roles (20260823223419); balances move only
--     through the service-only wallet_credit / wallet_debit functions (20260804103153).
--   * Signup creates the wallet server-side with the 10 welcome credits (create_wallet_for_user,
--     20260419162457). The only client insert is WalletCard's fallback for accounts that have no
--     row, which sends { user_id, credits: 10 }: the same welcome grant.
--
-- What
--   For a row inserted directly by an API role (current_user is anon or authenticated), the
--   trigger keeps user_id and sets the money fields itself: balance 0, credits at most the
--   10-credit welcome grant (never negative), currency USD (the wallet's only currency, see
--   supabase/functions/_shared/walletTopup.ts), timestamps now(). Nothing is refused, so
--   WalletCard keeps working unchanged.
--   current_user, not auth.role(): inside a SECURITY DEFINER function current_user is the
--   function owner, so create_wallet_for_user and wallet_credit (which insert 10 and 0 credits)
--   are not affected, and neither are the service role nor the SQL editor.
--
-- Not changed: the policy, the grants, existing rows. No user data is altered.
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_wallets_client_insert_starts_empty ON public.wallets;
--   DROP FUNCTION IF EXISTS public.wallets_client_insert_starts_empty();

CREATE OR REPLACE FUNCTION public.wallets_client_insert_starts_empty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.balance := 0;
    NEW.credits := LEAST(GREATEST(COALESCE(NEW.credits, 0), 0), 10);
    NEW.currency := 'USD';
    NEW.created_at := now();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallets_client_insert_starts_empty ON public.wallets;
CREATE TRIGGER trg_wallets_client_insert_starts_empty
  BEFORE INSERT ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.wallets_client_insert_starts_empty();
