
-- Remove the redundant overly-permissive SELECT policy
DROP POLICY "Anyone can view wallet addresses for profiles" ON public.wallet_connections;
