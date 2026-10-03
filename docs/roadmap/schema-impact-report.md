# Schema impact report: PROPOSED, NOT APPLIED

Status: nothing in this document has been run or added as a migration file. No migration will be added without explicit approval. Based on reading `origin/main` migrations; the live legacy backend was not inspected (Supabase connector not authorised), so live policies, grants and row counts are unknown. Migrations `20260824100000` and `20260825100000` are headed "PREPARED, NOT APPLIED" and their live state is unknown.

Read-only preflight (run once the connector is authorised, before any apply): dump `pg_policies` and `information_schema.column_privileges` for the tables below; count `project_collaborators` by `(status, role)`; count `project_deliverables` by `status`; count `invoices`/`milestones` with `status = 'paid'` grouped by `payment_method` and `payment_intent_id IS NULL`.

Order: M0 → M1 → M3 → M2 → M4. Each ships alone, in a transaction, with the captured pre-state used as its rollback script.

## M0: three single-row fixes requested in Slice D (SQL, so they cannot be done in code)

**M0a. `projects.created_by` takeover.** Current: UPDATE policy `USING (created_by = auth.uid() OR user_has_project_access(...))` with no `WITH CHECK`, and the column is updatable (20251005014449:53-60; grant 20260914110000:46-48). Any member, guests and pendings included, can set `created_by` to themselves.
```sql
CREATE OR REPLACE FUNCTION public.guard_project_created_by() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'projects.created_by is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_project_created_by BEFORE UPDATE OF created_by ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_created_by();
```
Risk: a legitimate ownership-transfer path would break. None found: the only client `created_by` update is `ClaimEvent.tsx:80`, on `creative_jams`, not `projects`; the service role is unaffected. Rollback: `DROP TRIGGER trg_guard_project_created_by`. Acceptance: member B runs `UPDATE projects SET created_by = B` as an authenticated user → error; owner A's other updates still succeed; service-role update still succeeds.

**M0b. Pin role on self-accept.** Current: `WITH CHECK (user_id = auth.uid() AND status = 'accepted')` (20260413014116:2-7); the invitee can change `role` (and any other column) while accepting.
```sql
CREATE OR REPLACE FUNCTION public.guard_collaborator_self_accept() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT EXISTS (
       SELECT 1 FROM public.projects p WHERE p.id = OLD.project_id AND p.created_by = auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'role/project/user cannot change on self-accept';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_collaborator_self_accept BEFORE UPDATE ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.guard_collaborator_self_accept();
```
Risk: an accept flow that deliberately sets a role would fail. None found: `AcceptInvite.tsx:133-140` sets only `status`, `user_id` and `accepted_at`, and the trigger only restricts rows where `OLD.user_id = auth.uid()`, so email-invite rows with no `user_id` yet are unaffected. Rollback: drop the trigger. Acceptance: invited guest B updates own row to `status='accepted', role='member'` → error; `status='accepted'` alone → succeeds with the original role.

**M0c. `match_copilot_memories` trusts `p_user_id`.** Current: `SECURITY DEFINER`, no `auth.uid()` check, no REVOKE (20260504115911:56-85); memories hold call summaries.
```sql
-- same signature, plpgsql body: IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
REVOKE EXECUTE ON FUNCTION public.match_copilot_memories(uuid, vector, int, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_copilot_memories(uuid, vector, int, real) TO authenticated, service_role;
```
Risk: callers must pass their own id (edge callers use the service role, where `auth.uid()` is NULL and the check passes). Rollback: restore the original definition and grants from the preflight dump. Acceptance: authenticated user A calls it with B's id → error; with A's id → rows; service-role call with any id → rows.

## M1: strict membership RLS (the 'pending' problem)

Current: `user_has_project_access()` admits `pending` (20260427234910:24-29) so invitees can load the accept banner. It also gates `project_files` and storage (20260420201228:60-103), `creative_assets`, `project_deliverables`, `project_notes`, call transcripts and `board-assets`. Pending invitees can therefore read files, notes, transcripts and recordings before accepting. Policies are role-blind beyond money columns.

Proposal: add `public.is_project_member(project_id, user_id)` = owner OR accepted collaborator (plus existing match participants). Keep `user_has_project_access()` only for the minimal project-shell read (`projects` SELECT, the invitee's own `project_collaborators` row) so the accept banner still renders. Re-point data-table and storage policies to `is_project_member`. Add role predicates for notes / time entries (`hourly_rate`) per `get_project_role`. Apply the money-column migration `20260825100000` only after its preflight.

Risk: HIGH. Wide policy surface (~770 migrations, grants set outside migrations per PRIVILEGE_DRIFT_INVESTIGATION.md); a wrong predicate locks members out of Studio. Rollback: replay the captured `pg_policies` definitions in the same transaction order; the legacy function stays in place so rollback is policy-only. Acceptance (two-party, run on a staging branch): users A owner, B pending, C accepted guest, D accepted creative, E outsider × tables (`project_files`, storage `project-files`, `project_notes`, `project_deliverables`, `project_messages`, `call_transcripts`, `milestones.amount`) × SELECT/INSERT/UPDATE/DELETE. Expected: E denied everything; B denied everything except the shell and own invitation row; C denied notes, rates and money; D allowed non-owner actions only.

## M2: exact-version approval

Current: `deliverable_versions` has no writer; approval is `status` + `reviewed_by` on a mutable row; `share_link_approvals` and `share_link_views` accept `INSERT WITH CHECK (true)` (20260502005203:63-80); five or more paths mutate files without resetting approval; the UI writes `changes_requested`, which the CHECK rejects.

Proposal: (1) trigger on `project_deliverables` file/submission changes inserts a `deliverable_versions` row with `version` and `content_hash`, bumps `version`, and resets `approved` → `submitted`; (2) add nullable `version_id` to `share_link_approvals` and `approved_version_id` to `project_deliverables`; (3) replace the `WITH CHECK (true)` inserts with deny-all for clients, since `redeem-project-share` writes with the service role; (4) align the status vocabulary (`revision_requested`).

Risk: MEDIUM. Existing approved rows have no version row, so backfill version 1 from the current file and mark prior approvals `legacy_unversioned` (never infer). Rollback: drop the trigger; the new columns are nullable and ignored by old code. Acceptance: owner uploads v1, client approves v1; owner uploads v2 → status returns to `submitted` and the approval still points at v1; an anonymous insert into `share_link_approvals` is denied; approving a deliverable of another project through a link returns 403 (code-level guard already in this slice).

## M3: effective revocation of guest / link access

Current: guest-link redemption creates a permanent accepted `role='guest'` collaborator (`redeem-project-guest-link:108-116`); revoking sets `revoked_at`, checked only at redeem time; stored signed URLs live 1 h to 7 days; realtime `project:` / `studio-room:` channels are public; `get_guest_files` returns up to 200 of all files.

Proposal: add nullable `project_collaborators.source_link_id` and `access_expires_at`; trigger on `project_guest_links.revoked_at` set → mark rows with that `source_link_id` `status='revoked'` (soft, restorable); `is_project_member` honours `status` and `access_expires_at`; make realtime channels private with a membership policy; shorten stored signed URLs (code) and stop persisting them in `file_url` / `submission_files`.

Risk: MEDIUM. Existing guest rows have no `source_link_id`; do NOT auto-delete them; list them for owner review. Rollback: drop the trigger and set `status='accepted'` on rows revoked by it (they are retained). Acceptance: guest redeems and reads files and messages; owner revokes; the guest's next file, message, storage and signed-URL request is denied and the token cannot be re-redeemed; a previously issued signed URL stops working within its shortened lifetime.

## M4: money factual-state separation

Current: manual `confirm_invoice_paid_manually` / `confirm_milestone_paid_offline` write the same `paid` as the Stripe webhook (20260812071205:429-526); the client UI says "Paid — thank you"; referral commission is written `paid` before the transfer (`capture-milestone-payment:162`); `useProjectFlow` treats Payment as satisfied without a payment; payouts have no milestone/invoice link.

Proposal: additive columns `invoices.paid_source` / `milestones.paid_source` (`provider_confirmed` | `issuer_recorded` | `payer_reported` | `legacy_unknown`) plus `provider_receipt_id`; webhook writes `provider_confirmed` with the receipt id; manual RPCs write `issuer_recorded`; `creator_payouts.milestone_id`; separate payout-authorised timestamp; commission `paid` only after the transfer succeeds. Apply `20260824100000` after preflight.

Risk: HIGH (payments). Backfill: `paid` with a `payment_intent_id` becomes `provider_confirmed` only after matching the Stripe event; everything else becomes `legacy_unknown`. Never infer. Rollback: additive columns, UI falls back to current `status`; the RPC changes are reverted from the preflight dump. Acceptance: manual mark shows "recorded by issuer, not provider-confirmed" and never "Paid — thank you"; a signed webhook event shows "provider-confirmed" with a receipt id; a failed transfer leaves the commission unpaid; a replayed webhook event changes nothing.

## Mapping of the Slice D asks to where they landed

| Ask | Landed in |
|---|---|
| Exclude `pending` in code paths we control | `_shared/projectAccess.ts` (6 functions). The SQL function still admits it (M1). |
| WITH CHECK on `created_by` takeover | Proposed as M0a, in trigger form because a `WITH CHECK` clause has no `OLD` reference (a self-subquery works but is fragile). |
| Pin role on self-accept | Proposed as M0b. |
| `auth.uid()` in `match_copilot_memories` | Proposed as M0c. |
