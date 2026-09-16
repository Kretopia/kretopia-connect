-- ============================================================
-- Studio Finding 1 remediation: role-based access to money fields
--
-- PREPARED, NOT APPLIED. Written in response to
-- STUDIO_CURRENT_STATE_AUDIT.md §7 finding 1 ("No role-based RLS
-- exists anywhere in Studio") and its direct dependency, finding 2
-- (guest-link tiers not enforced). Full narrative, scope decisions,
-- preflight/postflight queries, and negative tests are in
-- STUDIO_FINDING1_REMEDIATION_PLAN.md at repo root -- read that
-- alongside this file, don't apply this file in isolation.
--
-- Root problem: project_collaborators.role is free-text with no CHECK
-- constraint, and no RLS policy on any Studio table ever reads it --
-- every policy collapses to "accepted (or even pending) project
-- member," so a role='client' or role='guest' collaborator sees the
-- exact same milestones.amount/paid_to/paid_at/escrow_status and
-- projects.client_price/creative_payout/margin_value as the owner,
-- despite the frontend (useStudioRole.ts) deliberately hiding the
-- Money section from those roles. The UI hint was never a security
-- boundary.
--
-- Same root cause, same fix shape as every privilege-drift finding
-- this session (wallets, then milestones.status/escrow_status): a
-- column-level REVOKE alone is not reliable if a coexisting
-- table-level GRANT exists (Supabase's project-level default,
-- predating any tracked migration) -- so this migration REVOKEs at
-- the table level for the specific financial columns and re-GRANTs
-- only the safe columns, then exposes the financial columns solely
-- through SECURITY DEFINER RPCs that check the caller's actual role
-- server-side.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Data cleanup, THEN constrain project_collaborators.role
--
-- Discovered while writing this migration, not assumed from the audit
-- summary alone: supabase/functions/redeem-project-guest-link/index.ts:88-91
-- currently maps guest-link tiers to role values OUTSIDE the clean
-- 4-value set this migration wants to enforce --
-- contributor -> 'collaborator' (!), commenter -> 'commenter', only
-- viewer -> 'guest'. The 'collaborator' value is especially dangerous:
-- it is textually indistinguishable from a value a real, fully-trusted
-- team member might have, and nothing else in the codebase writes
-- 'collaborator' or 'commenter' as a role (grepped every INSERT/UPDATE
-- of project_collaborators.role). Fixed at the source in step 5 below
-- (the Edge Function is changed to always write 'guest' for all three
-- guest-link tiers) -- but that only stops FUTURE bad writes. Any
-- guest-link redemption that already happened before this migration
-- runs left a 'collaborator' or 'commenter' row sitting in the table
-- RIGHT NOW, and without cleaning it up first, a guest-link contributor
-- from last week would be normalized as a real, money-visible
-- 'collaborator' by get_project_role() below -- reopening finding 2
-- immediately. Run the preflight query in
-- STUDIO_FINDING1_REMEDIATION_PLAN.md §Preflight-2 first to see
-- exactly how many rows this touches before running it live.
--
-- CORRECTED after a live apply attempt failed
-- (project_collaborators_role_check violated by some row): the live
-- table has at least one role value that is neither one of the 4
-- allowed values nor one of the 2 legacy values named above --
-- something this migration's own grep of INSERT/UPDATE call sites
-- didn't catch (a value written by hand, by an older code path, or
-- imported data). Rather than chase down every possible stray value by
-- hand, this is now a catch-all: normalize ANYTHING not already valid
-- down to 'guest', the most restrictive tier -- fails closed (under-
-- grants money visibility, never over-grants it) for whatever the
-- unknown value turns out to be.
-- ------------------------------------------------------------
UPDATE public.project_collaborators
  SET role = 'guest'
  WHERE role IS NULL OR role NOT IN ('member', 'client', 'creative', 'guest');

-- Idempotent: a prior partial apply of this file already created this
-- constraint once (that's the exact error a re-run hits without the
-- guard: 42710 duplicate_object). Drop-then-add makes re-running this
-- file safe regardless of how far a previous attempt got.
ALTER TABLE public.project_collaborators
  DROP CONSTRAINT IF EXISTS project_collaborators_role_check;
ALTER TABLE public.project_collaborators
  ADD CONSTRAINT project_collaborators_role_check
  CHECK (role IN ('member', 'client', 'creative', 'guest'));

-- ------------------------------------------------------------
-- 2. Server-side role resolution -- mirrors useStudioRole.ts's logic
-- exactly (src/hooks/useStudioRole.ts:30-58) so the enforced role and
-- the displayed role can never drift apart. 'owner' is never a stored
-- role value; it's derived from projects.created_by, same as the
-- frontend hook.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _collab_role text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _project FROM public.projects WHERE id = _project_id;
  IF _project IS NULL THEN
    RETURN NULL;
  END IF;

  IF _project.created_by = _user_id THEN
    RETURN 'owner';
  END IF;

  SELECT role INTO _collab_role
  FROM public.project_collaborators
  WHERE project_id = _project_id AND user_id = _user_id AND status = 'accepted'
  LIMIT 1;

  IF _collab_role IS NULL THEN
    RETURN NULL; -- not a member at all
  END IF;

  -- Normalize exactly like useStudioRole.ts: only 'client'/'creative'/
  -- 'guest' are distinct; everything else (including the 'member'
  -- default) is the generic 'collaborator' tier.
  IF _collab_role IN ('client', 'creative', 'guest') THEN
    RETURN _collab_role;
  END IF;
  RETURN 'collaborator';
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_role(uuid, uuid) TO authenticated;

-- Money visibility rule, made an explicit named function rather than
-- inlined so the one rule is defined once and can't drift between the
-- milestones RPC and the projects RPC below.
--
-- Per the Feature Bible's own documented intent
-- (useStudioRole.ts:18-24 doc comment, cited in
-- STUDIO_CURRENT_STATE_AUDIT.md §4): "Client: ... NO money."
-- "Guest: stricter than client... no Money." Everyone else (owner,
-- creative, generic collaborator) currently sees money in the
-- frontend today, so this is the minimal fix that closes the actual
-- documented violation -- client/guest -- without introducing an
-- unspecified, unrequested finer split (e.g. "a creative can only see
-- their own milestone") that isn't clearly defined anywhere. See
-- STUDIO_FINDING1_REMEDIATION_PLAN.md "Deliberately out of scope" for
-- why that tighter rule is a follow-up, not part of this fix.
CREATE OR REPLACE FUNCTION public.can_see_milestone_money(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_project_role(_project_id, _user_id) IN ('owner', 'creative', 'collaborator');
$$;

REVOKE ALL ON FUNCTION public.can_see_milestone_money(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_milestone_money(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 3. milestones -- lock down the financial columns specifically.
--
-- Non-financial columns (title, description, status, due_date,
-- project_id, created_by, requested_by, import/external provenance)
-- stay exactly as readable as they are today for every accepted
-- member -- this migration does not touch who can see THAT a
-- milestone exists or its workflow status, only who can see its
-- money fields. status/paid_at/paid_to/escrow_status UPDATE was
-- already closed in 20260824100000_milestones_privilege_hardening.sql
-- (routed through update_milestone_workflow_status /
-- confirm_milestone_paid_offline) -- this migration is the SELECT-side
-- companion that migration didn't cover.
-- ------------------------------------------------------------
REVOKE SELECT (amount, paid_to, paid_at, escrow_status, payment_intent_id)
  ON public.milestones FROM authenticated, anon;

-- Re-grant SELECT on every other column so existing non-financial
-- reads (title/status/due_date-driven UI: task feeds, kanban boards,
-- the workflow-status RPC's own lookups) are completely unaffected.
GRANT SELECT (id, project_id, title, description, status, due_date,
  created_by, requested_by, created_at, updated_at,
  external_id, external_url, import_job_id, imported_at, source_provider)
  ON public.milestones TO authenticated;

CREATE OR REPLACE FUNCTION public.get_milestone_financials(_milestone_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _milestone RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _milestone FROM public.milestones WHERE id = _milestone_id;
  IF _milestone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'milestone_not_found');
  END IF;

  IF NOT public.can_see_milestone_money(_milestone.project_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'amount', _milestone.amount,
    'paid_to', _milestone.paid_to,
    'paid_at', _milestone.paid_at,
    'escrow_status', _milestone.escrow_status,
    'payment_intent_id', _milestone.payment_intent_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_milestone_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_milestone_financials(uuid) TO authenticated;

-- Batch variant -- every consumer found in the frontend checklist
-- (STUDIO_FINDING1_REMEDIATION_PLAN.md) loads a LIST of milestones for
-- a project, not one at a time; calling get_milestone_financials in a
-- loop per row would be one round-trip per milestone. This returns
-- the financial fields for every milestone in a project the caller is
-- authorized to see money for, empty array otherwise.
CREATE OR REPLACE FUNCTION public.get_project_milestone_financials(_project_id uuid)
RETURNS TABLE (
  milestone_id uuid,
  amount numeric,
  paid_to uuid,
  paid_at timestamptz,
  escrow_status text,
  payment_intent_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_see_milestone_money(_project_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT m.id, m.amount, m.paid_to, m.paid_at, m.escrow_status, m.payment_intent_id
    FROM public.milestones m
    WHERE m.project_id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_milestone_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_milestone_financials(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. projects -- lock down the aggregate financial columns.
--
-- Owner-only, matching useStudioRole.ts's canSeeMoney (documented as
-- "owner only" in STUDIO_CURRENT_STATE_AUDIT.md §4) -- stricter than
-- useAgentRole.ts's intent (client should see their own client_price,
-- creative their own payout in agent_mode), but useAgentRole has no
-- RLS backing it today either, and owner-only can never leak to the
-- wrong party -- it can only over-restrict a legitimate agent-mode
-- view, which is a UX gap to fix deliberately later, not a security
-- hole to leave open now. See the remediation plan's "deliberately
-- out of scope" section.
--
-- No frontend UPDATE call site was found for these four columns
-- (grepped; they appear to be set once, elsewhere, at project
-- creation) -- so this migration only adds an owner-only READ path,
-- not a replacement write RPC. If a legitimate write path is found
-- later, add update_project_financials() following the same pattern
-- as update_milestone_workflow_status before re-enabling UPDATE.
-- ------------------------------------------------------------
REVOKE SELECT (client_price, creative_payout, margin_type, margin_value)
  ON public.projects FROM authenticated, anon;

-- No column list given for the re-GRANT here on purpose: the exact
-- non-financial column set on `projects` is large and actively
-- growing (14+ migrations have added columns), and this table's other
-- columns were never gated in the first place -- listing them
-- explicitly would silently go stale the next time someone adds a
-- column. Re-grant everything EXCEPT the four financial ones by
-- reflecting the current column list at migration time instead.
DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name NOT IN ('client_price', 'creative_payout', 'margin_type', 'margin_value')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.projects TO authenticated', _col);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_project_financials(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _project FROM public.projects WHERE id = _project_id;
  IF _project IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_found');
  END IF;

  IF _project.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'client_price', _project.client_price,
    'creative_payout', _project.creative_payout,
    'margin_type', _project.margin_type,
    'margin_value', _project.margin_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_financials(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. Guest-link redemption must actually set role='guest'
--
-- Finding 2's direct fix, bundled here because it's meaningless
-- without step 1-4 above. As corrected in step 1's comment: the
-- pre-fix redeem-project-guest-link Edge Function did not merely
-- leave role at the table default -- it explicitly wrote
-- role: 'collaborator' for contributor-tier links and
-- role: 'commenter' for commenter-tier links, only 'viewer' actually
-- landed on 'guest'. Step 1's UPDATE cleans up rows this already
-- produced; the Edge Function itself has been changed (not yet
-- deployed) to write role: 'guest' unconditionally for all three
-- tiers going forward -- see the diff in
-- supabase/functions/redeem-project-guest-link/index.ts and
-- STUDIO_FINDING1_REMEDIATION_PLAN.md §4. That is Deno/Edge Function
-- code, not SQL, so it isn't in this migration file, but this
-- migration is not a complete fix without it: applying this SQL
-- without deploying that change would make the very next
-- contributor-tier redemption fail the new CHECK constraint outright
-- (a hard 500), since the Edge Function would still try to insert a
-- value this migration no longer allows. Do not apply this migration
-- without also shipping that Edge Function change in the same
-- release.
-- ------------------------------------------------------------

-- Nothing to execute in this section -- documentation only, per above.
