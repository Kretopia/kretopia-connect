# Claim a scouted gig by token (F28)

**Status: approved 2026-10-09** ("the flow must really work"; two-step migration validated). Implemented as
`supabase/migrations/20261009100000_opportunity_claim_by_token.sql` + the frontend change in the same PR. The
file is **not applied** until the frontend is published.

**One change from the plan below, for safety:** the proposal had two steps (functions, then the grant change). Run
that way, there is a window where claiming works while the old tokens are still public. The migration is therefore
**one script, applied after the frontend is published**: functions, clearing the publicly readable tokens, and the
`claim_token` grant change together. Before it is applied the frontend does not read the token at all, so it is safe
to publish first; the claim page and the share button simply report an error until the script runs (they did not work
before either). Scouts get a fresh, cryptographically random link from the gig page; links shared earlier never worked.

(Original proposal text follows.)

## Finding (verified on production, read-only)

1. **Claiming a scouted gig has never worked.** `opportunities` has one UPDATE policy,
   `auth.uid() = created_by`. The person claiming a gig is not its `created_by` (the scout is), so the
   `UPDATE … WHERE claim_token = … AND claim_status = 'unclaimed'` that `ClaimGig` runs matches **0 rows**. All 22
   opportunities on production are `unclaimed`: none was ever claimed. The page used to answer "Gig claimed!"
   anyway (fixed in #105: it now says it could not claim).
2. **The claim tokens are public.** `OPPORTUNITY_PUBLIC_COLUMNS` includes `claim_token` and the public SELECT policy
   covers every `status = 'active'` row, so an anonymous visitor can read the token of every unclaimed gig
   (probed with the public key, counts only: 4 unclaimed gigs with a readable token, 16 characters = 64 bits).
   **Harmless today, and only because of point 1.** No function or edge function claims by token, so a leaked
   token grants nothing. The moment claiming is made to work, the public tokens would let anyone take any gig
   (the exact hole 0300/0400 closed for events).

So the feature cannot be repaired by just fixing the policy: the tokens must stop being public first.

## What the fix changes (impact report)

| Area | Change | Who notices |
|---|---|---|
| New functions | `get_scouted_opportunity_by_token(token)` (anon + signed-in, returns the gig card only) and `claim_scouted_opportunity(token)` (signed-in only, atomic), `get_my_opportunity_claim_token(id)` (the scout or owner gets their own share link) | nobody until the frontend uses them |
| Column grant | `claim_token` leaves the SELECT grant of `anon` and `authenticated` (same table-level REVOKE then per-column GRANT pattern as `20260905110000_lock_opportunities_guest_contact_columns.sql`) | any client still selecting `claim_token` gets "permission denied for column" |
| Frontend (same PR) | drop `claim_token` from `OPPORTUNITY_PUBLIC_COLUMNS`; `ClaimGig` uses the two functions; `OpportunityDetail` reads the owner's own token through `get_my_opportunity_claim_token`; `ScoutGigDialog` is unaffected (the token comes from the edge function, service role) | unclaimed gigs finally become claimable |
| Existing data | none changed; the 22 existing tokens stay valid for their scouts and become private | scouts' already-shared links start working |
| RLS, auth, payments | untouched | - |

**Order (same as events):** apply the additive SQL (functions only) → publish the frontend → apply the REVOKE/GRANT
(the step that breaks old clients). Applying the REVOKE first breaks `OpportunityDetail` and `ClaimGig`.

**Risks:** (1) a client I did not find that selects `claim_token` (mitigation: grep is done, only `OpportunityDetail`
and `ClaimGig` read it; a `permission denied for column` shows up immediately in the console); (2) 64-bit tokens are
weak against enumeration once claiming works (mitigation in the SQL: the claim function is only reachable by signed-in
users and the new tokens use the crypto generator from 0300; a rate limit is a separate item).

**Rollback:** `GRANT SELECT (claim_token) ON public.opportunities TO anon, authenticated;` and
`DROP FUNCTION` the three functions. No data is modified by the migration.

## Draft SQL (for review, not applied)

```sql
-- 1. ADDITIVE: apply first.
CREATE OR REPLACE FUNCTION public.get_scouted_opportunity_by_token(p_token text)
RETURNS TABLE(id uuid, title text, type text, description text, compensation text, location text,
              claim_status text, scouted_by uuid, created_by uuid, image_url text, source_platform text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.title, o.type, o.description, o.compensation, o.location,
         o.claim_status, o.scouted_by, o.created_by, o.image_url, o.source_platform
  FROM public.opportunities o
  WHERE p_token IS NOT NULL AND length(p_token) >= 12 AND o.claim_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_opportunity(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to claim this gig' USING ERRCODE = '42501'; END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_token'); END IF;
  UPDATE public.opportunities SET created_by = v_uid, claim_status = 'claimed'
   WHERE claim_token = p_token AND claim_status = 'unclaimed'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('claimed', false, 'reason', 'not_available'); END IF;
  RETURN jsonb_build_object('claimed', true, 'opportunity_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_opportunity_claim_token(p_opportunity_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.claim_token FROM public.opportunities o
  WHERE o.id = p_opportunity_id AND o.claim_status = 'unclaimed'
    AND (o.scouted_by = auth.uid() OR o.created_by = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_scouted_opportunity_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scouted_opportunity_by_token(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_scouted_opportunity(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_scouted_opportunity(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_opportunity_claim_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_opportunity_claim_token(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- 2. ONLY AFTER the frontend that uses the functions is published.
REVOKE SELECT ON public.opportunities FROM anon, authenticated;
DO $$
DECLARE _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities'
      AND column_name NOT IN ('guest_email', 'guest_company_name', 'guest_logo_url', 'guest_profile_id',
                              'verification_token', 'claim_token')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.opportunities TO anon, authenticated', _col);
  END LOOP;
END $$;
```

## What I need from you

1. Is "a scout lists a gig, the poster claims it with a link" a feature you want working? If not, the simpler fix is to
   **remove** the claim route and the share link, and still stop publishing `claim_token`.
2. If yes: approve the two-step migration above (functions, then the grant change after the frontend is published).
   I will then ship the frontend PR first, exactly as for events.
