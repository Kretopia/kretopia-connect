-- Warning flagged by the deep security scan: the 'Anyone can view active
-- managers by referral code' policy on talent_managers applies to the anon
-- role with USING (is_active = true) -- no filter on referral_code at all,
-- so it allows a full table scan returning commission_rate, total_earned,
-- and total_referred for every active manager, not just the one manager a
-- signup flow looks up by code.
--
-- Confirmed via grep: the only place this is read is
-- src/pages/Onboarding.tsx, which looks up a single manager by referral_code
-- and only ever needs the row's id. Replace the blanket table policy with a
-- SECURITY DEFINER lookup function that takes the code as a parameter and
-- returns only non-financial columns, then drop the policy so no other
-- anon/authenticated query can select this table by anything other than
-- ownership.

CREATE OR REPLACE FUNCTION public.get_talent_manager_by_referral_code(p_referral_code text)
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tm.id, tm.display_name
  FROM public.talent_managers tm
  WHERE tm.referral_code = p_referral_code
    AND tm.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_talent_manager_by_referral_code(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view active managers by referral code" ON public.talent_managers;

-- Warning flagged by the deep security scan: "Users can update their own
-- referral network" -- no, this section is for waitlist:
--
-- The 'Authenticated users can submit to waitlist' policy allows any caller
-- (the policy has no `TO` clause and WITH CHECK (true), so it's not
-- actually authenticated-only) to insert a row with any email address and
-- social links, unrelated to who they are.
--
-- Confirmed via grep: src/components/landing/WaitlistForm.tsx is a public,
-- pre-launch landing-page form that must keep working for logged-out
-- visitors (there is no account to own an email against at that point) --
-- so requiring email = auth.jwt()->>'email' unconditionally would break the
-- primary use case. The fix instead closes only the reachable abuse case:
-- when the caller IS signed in, their submitted email must match their own
-- account; anonymous (logged-out) submissions are unaffected.

DROP POLICY IF EXISTS "Authenticated users can submit to waitlist" ON public.waitlist;

CREATE POLICY "Users can submit to waitlist"
ON public.waitlist FOR INSERT
WITH CHECK (
  auth.uid() IS NULL OR email = (auth.jwt() ->> 'email')
);
