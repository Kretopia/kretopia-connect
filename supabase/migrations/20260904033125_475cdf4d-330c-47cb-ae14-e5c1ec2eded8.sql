DROP POLICY IF EXISTS "Users can insert their own referral network" ON public.referral_network;
DROP POLICY IF EXISTS "Users can update their own referral network" ON public.referral_network;

REVOKE INSERT, UPDATE ON public.referral_network FROM authenticated, anon;