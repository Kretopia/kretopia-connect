-- Flagged in this session's performance audit: public.transactions
-- (the wallet ledger, 20250930110718) has never had any index, not even
-- on user_id. Every real read (src/components/WalletCard.tsx:54-57,
-- src/pages/ThrivePay.tsx:262-265) filters on user_id and orders by
-- created_at descending -- both hit a full sequential scan today.
-- Composite index covers both the filter and the sort in one pass.

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
  ON public.transactions (user_id, created_at DESC);
