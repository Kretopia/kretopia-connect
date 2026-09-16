
-- 1) recipient_bank_accounts: scope to actual transfer counterparties
DROP POLICY IF EXISTS "Senders view active bank accounts of recipient" ON public.recipient_bank_accounts;
CREATE POLICY "Senders view recipient bank for their transfers"
ON public.recipient_bank_accounts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.wallet_transfers wt
    WHERE wt.sender_id = auth.uid()
      AND wt.recipient_id = recipient_bank_accounts.user_id
  )
);

-- 2) profiles: drop the blanket-true SELECT policy
DROP POLICY IF EXISTS "Authenticated users view safe profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can safe view profiles" ON public.profiles;

-- Defense-in-depth: revoke sensitive columns from non-owners at the GRANT layer.
-- Owner access is preserved via the existing "Owner full access" policy.
REVOKE SELECT (phone_otp, phone_otp_expires_at) ON public.profiles FROM authenticated, anon;

-- 3) newsletter_subscribers: lock to admins only
DROP POLICY IF EXISTS "Service can read subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins read subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) jam_participants: keep public visibility but hide the secret check-in token
REVOKE SELECT (check_in_token) ON public.jam_participants FROM anon, authenticated;
-- Re-grant to specific paths via SECURITY DEFINER helper (already used by edge fns via service_role)
-- Owner can still see their own token via this RPC:
CREATE OR REPLACE FUNCTION public.get_my_check_in_token(_jam_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_in_token
  FROM public.jam_participants
  WHERE jam_id = _jam_id AND user_id = auth.uid()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_check_in_token(uuid) TO authenticated;

-- Hosts can still read tokens for their own events via this RPC:
CREATE OR REPLACE FUNCTION public.get_event_check_in_tokens(_jam_id uuid)
RETURNS TABLE (user_id uuid, check_in_token text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jp.user_id, jp.check_in_token, jp.status
  FROM public.jam_participants jp
  JOIN public.creative_jams cj ON cj.id = jp.jam_id
  WHERE jp.jam_id = _jam_id AND cj.created_by = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_event_check_in_tokens(uuid) TO authenticated;

-- 5) project-files bucket: drop the weak upload policy
DROP POLICY IF EXISTS "Users can upload files to their projects" ON storage.objects;
