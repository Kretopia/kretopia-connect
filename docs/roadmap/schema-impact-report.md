# Schema impact report: PROPOSED, NOT APPLIED

Update 2026-10-20: **M6 (guard on the payer columns of `projects`) is APPLIED to production** (approved; see M6 below). **M5 (`call_transcripts` has no client UPDATE) is APPLIED to production** (approved; see M5 below). Update 2026-10-19: **M0a is APPLIED to production** (approved; see M0a below). M0b is also in place (trigger `trg_guard_project_collaborator_self_update`) and M0c is closed (`match_copilot_memories` has no `anon` or `authenticated` EXECUTE). Everything else below is still proposed.

Status (original, October 3): nothing in this document has been run or added as a migration file. No migration will be added without explicit approval. Based on reading `origin/main` migrations; the live legacy backend was not inspected (Supabase connector not authorised), so live policies, grants and row counts are unknown. Migrations `20260824100000` and `20260825100000` are headed "PREPARED, NOT APPLIED" and their live state is unknown.

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
**Applied 2026-10-19** to the production database, exactly as written above, file `supabase/migrations/20261019120000_guard_project_created_by.sql`. Verified: catalog (trigger enabled, BEFORE UPDATE OF `created_by`, row level); a `member`-role collaborator running `UPDATE projects SET created_by = <self>` got `projects.created_by is immutable` and the owner was unchanged; an update that leaves `created_by` unchanged still succeeds. Preflight: no DB function or client code changes `projects.created_by`; 75 projects, none without an owner. The service-role path (`auth.uid()` NULL) was not exercised with a real ownership change, on purpose.

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

Update 2026-10-20: the `pending` part is already closed in production: `user_has_project_access()` there says "'pending' is NOT access" and requires `accepted`, and `is_project_member` exists. What remains of M1 is that policies are role-blind (any accepted collaborator, guests included, can write); the sharpest case is M6.

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

## M5: `call_transcripts` has no client UPDATE (APPLIED 2026-10-20)

Evidence, production, read-only, 2026-10-20:
- Policies on the table: `service role manages transcripts` (ALL, service role), `view own/participant transcripts` (SELECT, `user_can_view_call_transcript`), `creator can update own transcript` (UPDATE, `created_by = auth.uid()`, no WITH CHECK). There is no INSERT or DELETE policy for clients.
- Column privileges: both `anon` and `authenticated` hold UPDATE on all 25 columns, including `recording_id`, `created_by`, `project_id`, `call_kind`, `call_id`, `participants`, `transcript`, `summary`, `recording_url`. For `anon`, RLS stops it today (`auth.uid()` is null); the grant is still wider than needed.
- Who writes the table: only the service role. `daily-recording-webhook`, `sync-daily-recordings`, `transcribe-call`, `get-recording-link` (caches `recording_url`), `purge-expired-recordings` and `_shared/recordingRow.ts` all use the admin client. `accept-call-action-item` and `get-recording-link` read the table with the caller's client and only SELECT. The frontend never updates it: the references are `CallRecapSheet` (select and a realtime subscription), `RecentRecordingsRail`, `useCallHistory`, `loadRecordings` (all select). No SQL function in `public` updates it, and none is `SECURITY INVOKER` over it.
- Therefore no legitimate flow needs a client UPDATE.

Proposal: remove the client UPDATE path entirely: drop the `creator can update own transcript` policy and revoke UPDATE on the table from `anon` and `authenticated`. Keep SELECT, the service-role policy and all edge writers untouched. Optional hardening, separate decision: also revoke INSERT from `anon` and `authenticated` (no INSERT policy exists, so RLS already blocks it).

Risk: LOW. Realtime UPDATE events keep reaching subscribers (they depend on SELECT, not on the UPDATE privilege). If a client write exists that this scan missed, it fails with `permission denied` instead of silently changing the row. Rollback: re-grant UPDATE to `authenticated` and recreate the policy with the same predicate (kept in this section).

**Applied 2026-10-20** to the production database with approval, file `supabase/migrations/20261020120000_call_transcripts_no_client_update.sql` (drop the policy, revoke UPDATE from `anon` and `authenticated`; the optional INSERT revoke was not part of the approval and was not done). Verified in production: before, a creator's UPDATE of their own row succeeded; after, it fails with `permission denied for table call_transcripts`; the creator can still SELECT their row; `service_role` can still UPDATE (the edge writers); the table still has 30 rows and the only policies left are the service-role ALL and the SELECT policy; the table ACL for `anon` and `authenticated` went from `arwdDxtm` to `ardDxtm` (no `w`). Each check ran inside a block that always rolls back.

Acceptance (after apply, as a creator of a transcript): an UPDATE of `recording_id` or `project_id` is refused; the Recordings page, a call recap and a recording link still work; a new recording still produces a row (service role). A migration file and the captured pre-state would be added in the same PR as the approval.

## M6: payer and agent columns on `projects` are writable by any accepted collaborator (APPLIED 2026-10-20)

Evidence, production, read-only, 2026-10-20 (the one write test ran in a block that always rolls back):
- The `projects` UPDATE policy admits the owner and every accepted collaborator whatever their role, and `authenticated` holds UPDATE on all columns except four money columns (`client_price`, `creative_payout`, `margin_type`, `margin_value`, which are protected by column grants and were confirmed refused). M0a closed `created_by` only.
- Writable by an accepted `guest` (7 exist in production; 26 accepted `member`s): `client_user_id`, `agent_user_id`, `creative_user_ids`, `agent_mode`, and also `status`, `budget`, `deadline`, `recap_published`, `recap_summary`, `video_room_url`, `match_id`, `event_id`. A rolled-back test as a real guest confirmed that setting `client_user_id` to themselves succeeds (1 row).
- Why `client_user_id` matters: it is the payer authority. `confirm_milestone_paid_offline`, `update_milestone_workflow_status` (approve), `escrowAuth.ts` (escrow release), `create-milestone-payment`, `batch-milestone-payout` and `resolveMilestonePayee.ts` all treat `client_user_id` (or the owner) as the party allowed to confirm, approve, pay or release. A collaborator who can name themselves as client can therefore act as the payer. What a falsely "paid" milestone unlocks downstream was not traced in this report.
- Nothing writes these columns from the app: the frontend and the edge functions only read `client_user_id`, `agent_user_id` and `creative_user_ids` (searched `src/` and `supabase/functions/`). The frontend's project updates touch title, description, status, mood, cover, folder, stage, recap and setup flags.
- No sign of use: 75 projects, none has `client_user_id` set; 5 milestones (4 pending, 1 requested), none paid. The blast radius today is small, and it grows as soon as the payer flows go live.

Proposal (same shape as M0a, because an RLS `WITH CHECK` cannot compare old and new values): a guard that lets only the project owner (`created_by`) or the service role change `client_user_id`, `agent_user_id`, `creative_user_ids` and `agent_mode`; everyone else gets an error. Nothing legitimate is affected because no client flow writes them. Also noted: `client_id` / `client_name` (CRM link and label) are not payer authority and are left alone.

Product decision, not proposed here: who may change `status`, `recap_published`, `recap_summary`, `budget`, `deadline`, `video_room_url`, `match_id` and `event_id`. Today a guest can mark a project completed (which creates pending credits for all collaborators through `auto_generate_project_credits`) or publish its recap. Options: owner-only for status and recap; or role-based. This is the role-blind remainder of M1 below.

Risk: LOW for the guard. Rollback: drop the trigger and its function. **Applied 2026-10-20** to the production database with approval, file `supabase/migrations/20261020130000_guard_project_payer_columns.sql` (trigger `trg_guard_project_payer_columns`, BEFORE UPDATE OF the four columns, owner or service role only; unchanged values pass). Verified in production with rolled-back tests: an accepted guest is refused on `client_user_id`, `creative_user_ids`, `agent_user_id` and `agent_mode`; an accepted member is refused on `client_user_id`; the owner and the service role succeed; a guest's ordinary edit and a no-op write of the guarded columns still pass; both guard triggers (`created_by`, payer columns) are enabled; data unchanged afterwards (75 projects, 0 with a client, 0 paid milestones).

## M7: the email-invite preview token is minted from a project id and an email (DATABASE PART APPLIED 2026-10-20; app and edge function ship with PR #237)

Evidence, production and code, read-only, 2026-10-20:
- The invitation email links to `/accept-invite/<projectId>?email=<email>` (`send-project-invitation/index.ts`). The page, for a signed-out visitor, calls `get_or_create_guest_token_for_invite(project, email)` (`AcceptInvite.tsx`). The function is callable by anonymous users and checks only that a **pending** invite exists for that email on that project; it then returns the existing live token for that email or mints one. The link carries no secret: the project id and the address are the whole credential.
- What a token gives (all anonymous RPCs): the project summary (title, description, status, owner id, client name, cover), the project's file list (up to 200 rows with their file URLs), the accepted team (names, avatars, roles), the pulse feed, and the ability to **post** to the pulse as a guest.
- Tokens are strong (24 random bytes) but never expire: `expires_at` is null and the mint does not set it. Production has 8 guest tokens, all live, 0 revoked, 1 of them an "Email invite preview"; 13 pending invitations have an email address. A token stays valid after the invite is accepted or withdrawn unless someone revokes it (this overlaps M3).
- Exposure: anyone who knows a project id and a pending invitee's address (forwarded or logged links, a leaked project id plus a guessed address) can open the guest view. **P2**, not exploited as far as the data shows.

Proposal (needs a migration, an edge function change and a frontend change, in this order):
1. Additive migration: an unguessable invite secret stored with the pending invitation (nullable, so existing rows are untouched).
2. `send-project-invitation` (edge function, manual paste) generates the secret and puts it in the emailed link; the invite page forwards it.
3. The mint requires the secret when the invitation has one. Invitations created before the change have none, so they keep the email-only check until they are accepted or removed; after that the fallback can be deleted. Old emails keep working in the meantime; nothing breaks for the 13 pending invites.
4. Minted tokens get a finite `expires_at`, and are revoked when the invitation is accepted or withdrawn (shares work with M3).

**Correction found while implementing (2026-10-20).** The first paragraph above says the email links to `/accept-invite/<projectId>?email=<email>`. More precisely, the email's main link is a one-tap sign-in (magic) link whose post-login redirect is that URL; a signed-in visitor goes through the normal accept flow and never touches the anonymous function. The anonymous mint is the fallback for a visitor who lands signed out (an expired or already used sign-in link, another device). The edge function also mints a preview token itself when no sign-in link can be issued. The exposure is unchanged, because the function is callable directly by anyone, but the secret has to ride in the redirect URL (`?t=`), not in a separate link.

**Applied 2026-10-20** to the production database with approval, file `supabase/migrations/20261020150000_guest_invite_token_secret.sql`: nullable column `project_collaborators.invite_secret_hash` (SHA-256 hex of the secret); the function now takes an optional `_secret` (the 2-argument version was dropped; calls with two named arguments resolve to the new one, confirmed through the public API) and requires it when the invitation has a hash, while the 13 existing pending invitations have none and keep the address-only check; tokens minted by the function expire after 14 days and an expired token is not reused; a trigger revokes the tokens minted for an invitation (labels "Email invite preview" and "Invite for ...") when it stops being pending, accepted or withdrawn, and leaves the owner's own guest links alone. Verified in production with rolled-back tests: legacy invitation mints with no secret; with a hash set, no secret and a wrong secret get nothing and the right one gets a token expiring in 14 days; accepting the invitation revokes the invitation token and not the owner's link; the owner withdrawing the invitation (as the signed-in owner) revokes it; data unchanged afterwards (8 tokens, 13 pending, 0 hashes). Not yet effective for new invitations: the frontend (reads `?t=`, publish) and `send-project-invitation` (generates and stores the secret, manual paste, with the new `_shared/inviteSecret.ts` first) ship in the code PR. Publish the frontend before pasting the edge function.

Risk: MEDIUM (three surfaces, one anonymous entry point). Rollback: the migration is additive; reverting the RPC and the frontend restores today's behaviour. Acceptance: a signed-out visitor with the emailed link gets the preview; the same project id and address without the secret gets nothing; a legacy invitation still works; an accepted or withdrawn invitation's token stops working; the owner's invite flow and the signed-in accept flow are unchanged.

## Mapping of the Slice D asks to where they landed

| Ask | Landed in |
|---|---|
| Exclude `pending` in code paths we control | `_shared/projectAccess.ts` (6 functions). The SQL function still admits it (M1). |
| WITH CHECK on `created_by` takeover | Proposed as M0a, in trigger form because a `WITH CHECK` clause has no `OLD` reference (a self-subquery works but is fragile). |
| Pin role on self-accept | Proposed as M0b. |
| `auth.uid()` in `match_copilot_memories` | Proposed as M0c. |
