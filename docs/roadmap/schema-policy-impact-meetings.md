# Schema / policy impact proposal: meetings

Proposal only. **Nothing here was applied, and nothing here is runnable.** Per the program rules (and a past incident where a draft SQL block in a proposal was pasted and run), the statement sketches below use `<PLACEHOLDER>` tokens and will fail if pasted. The real migration is written only after approval, in its own PR, against the live definitions captured in step 0.

Covers the SQL half of the Gate 1 meeting findings that slices E to I could not fix in code: **GA SEC-06** (denied/removed still members), **SEC-07** (own participant row mutable), **SEC-08** (share link becomes a permanent right), **SEC-10** (two transcript stores with different audiences), plus a gap found while writing slice I: direct writes bypass the `create-meeting` context check. Matrix rows 4, 5, 16 and 18 of `gate-audit-company-experience-execution-matrix.md`.

## 0. Prerequisite: capture the live state

The audit and this repository agree on one thing: a migration's presence is not proof it was applied. Before any change, capture from the target database (read-only):

- the effective definition of `is_meeting_member`, `is_meeting_host` (`pg_get_functiondef`);
- every policy on `meetings`, `meeting_participants`, `meeting_recordings`, `meeting_transcripts`, and on `storage.objects` for bucket `meeting-recordings` (`pg_policies`);
- column and function grants for `anon` and `authenticated` on those objects;
- triggers on `meeting_participants` and `meetings`.

This document is written against `supabase/migrations/20260512184606_*` (the only migration that defines these objects in this repository). Any difference found in step 0 changes the proposal.

## 1. Objects affected and current unsafe behaviour

| # | Object | Current behaviour (from the repository) | Finding |
|---|---|---|---|
| 1 | `public.is_meeting_member(meeting, user)` | True for the host, or for **any** `meeting_participants` row regardless of `status` | SEC-06 |
| 2 | Policies that call it: `meetings` "Members can view meetings"; `meeting_participants` "Members view participants"; `meeting_recordings` "Members view recordings"; `meeting_transcripts` "Members view transcripts"; `storage.objects` "Members read meeting recordings" | A `denied` or `removed` person keeps reading the meeting, its participants, recordings, transcripts and recording objects | SEC-06, SEC-10 |
| 3 | `meeting_participants` policy "User updates own participant row" | `USING` and `WITH CHECK` fix only `user_id = auth.uid()`: the owner of a row can change its `role`, `status` and `meeting_id` | SEC-07 |
| 4 | `meetings.share_token` + `meetings` SELECT policy (row-level, all columns) | Every member, including a removed one, can read `share_token`; there is no expiry, rotation or revocation; the token handler turns a link holder into a permanent attendee row | SEC-08 |
| 5 | `meetings` policy "Hosts manage their meetings" (`FOR ALL`, `host_id = auth.uid()`) | An authenticated user can insert or update their own meeting directly through the data API with **any** `project_id` / `circle_id` / `event_id` / `conversation_id`, bypassing the check added to `create-meeting` in slice I. The context columns have no foreign keys | SEC-05 |
| 6 | `supabase_realtime` publication on `meetings` and `meeting_participants` | Changes are filtered by the same RLS, so #1 and #2 also leak live updates to a removed member | SEC-06 |
| 7 | `call_transcripts` (creator only for meetings and stages) vs `meeting_transcripts` / `meeting_recordings` (members) | The same product concept has two stores with incompatible audiences | SEC-10 |

Writers of `meeting_participants` today are all edge functions using the service role (`create-meeting`, `mint-meeting-token`); no client code in `src/` writes the table. That is what makes #3 low-risk to tighten.

## 2. Target policy (what must be true afterwards)

1. A participant row grants membership only while its status is one of `invited`, `knocking`, `joined`, `left`. `denied` and `removed` grant nothing, anywhere (tables, storage, realtime). The host is always a member.
2. A non-host user may change only a defined subset of their own row: `status` along `invited -> knocking | joined | left` and `joined | left -> joined | left`. They cannot change `role`, `meeting_id`, `user_id`, and cannot move out of `denied` or `removed`. The host and the service role are unaffected.
3. A share link is a revocable, expiring credential: it can be rotated by the host, optionally expires, and rotating it can remove the attendees who entered through it. Entering by link is recorded on the row.
4. `share_token` is readable by the host (and the service role) only.
5. A meeting's `project_id` and `circle_id` can be set only by a user who has strict access to them, whatever the write path; both have foreign keys.
6. There is one named canonical store for transcripts per meeting kind, with one documented audience. (Product decision, see section 7.)

## 3. Migration sketches (NOT RUNNABLE, for review of intent only)

The numbering is the proposed order. Each is its own migration file and its own PR.

```
-- M-A  is_meeting_member excludes revoked statuses            [fixes #1, #2, #6 at once]
-- NOT RUNNABLE
CREATE OR REPLACE FUNCTION public.is_meeting_member(<meeting>, <user>)
  -- host OR exists(participant row WHERE status NOT IN ('denied','removed'))
  -- keep: LANGUAGE sql, STABLE, SECURITY DEFINER, fixed search_path (as today)
  -- keep: argument names and types, so no policy has to be recreated
```

```
-- M-B  freeze own-row updates                                  [fixes #3]
-- NOT RUNNABLE
CREATE FUNCTION <guard_participant_update>() RETURNS trigger
  -- when auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT host:
  --   require NEW.role = OLD.role, NEW.meeting_id = OLD.meeting_id, NEW.user_id = OLD.user_id
  --   require OLD.status NOT IN ('denied','removed')
  --   require (OLD.status, NEW.status) in the allowed transition table (section 2.2)
  -- service role (auth.uid() IS NULL) and host: unchanged
CREATE TRIGGER <name> BEFORE UPDATE ON public.meeting_participants FOR EACH ROW ...
-- RLS predicate stays as is: the trigger is where OLD and NEW can be compared
```

```
-- M-C  link provenance and rotation                            [fixes #4, SEC-08]
-- NOT RUNNABLE
ALTER TABLE public.meeting_participants ADD COLUMN <joined_via> text NULL
  CHECK (<joined_via> IS NULL OR <joined_via> IN ('host','invite','link','knock'))
ALTER TABLE public.meetings ADD COLUMN <share_token_expires_at> timestamptz NULL
CREATE FUNCTION <rotate_meeting_share_token>(<meeting>, <revoke_link_attendees> boolean)
  -- SECURITY DEFINER; caller must be the host (auth.uid() = meetings.host_id)
  -- sets a new token; if <revoke_link_attendees>, sets status 'removed' on rows with joined_via = 'link'
  -- returns the new token to the host only
-- Code change that goes with it (separate PR): mint-meeting-token records joined_via = 'link',
-- and refuses an expired token.
```

```
-- M-D  share_token out of the member-readable row              [fixes #4 exposure]
-- NOT RUNNABLE
-- Option 1 (recommended): move the token to a table with host-only RLS
CREATE TABLE <meeting_access_tokens> (<meeting> PK -> meetings, <token> unique, <expires_at>, <rotated_at>)
--   backfill from meetings.share_token, switch the three writers and the one reader
--   (create-meeting, book-meeting, accept-room-knock, mint-meeting-token), then drop the column
-- Option 2 (rejected): column-level REVOKE on meetings.share_token.
--   Any `select *` on meetings by a non-host would then fail with a permission error.
```

```
-- M-E  context ids must be provable on every write path        [fixes #5]
-- NOT RUNNABLE
ALTER TABLE public.meetings
  ADD CONSTRAINT <fk_project> FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL <NOT VALID first>
  ADD CONSTRAINT <fk_circle>  FOREIGN KEY (circle_id)  REFERENCES public.spark_rooms(id) ON DELETE SET NULL <NOT VALID first>
CREATE FUNCTION <guard_meeting_context>() RETURNS trigger
  -- BEFORE INSERT OR UPDATE OF project_id, circle_id ON meetings
  -- when auth.uid() IS NOT NULL: project_id requires owner or ACCEPTED collaborator
  --   (the strict rule of supabase/functions/_shared/projectAccess.ts), circle_id requires creator or member
  -- service role: unchanged (the edge functions already check)
```

`conversation_id` and `event_id` are intentionally absent from M-E: no `conversations` table and no events table definition were found in the migrations (slice I left them unchecked for the same reason). They need their canonical record read first.

## 4. Storage policy impact

- Bucket `meeting-recordings` is private (`public = false`). No bucket is created or made public by this proposal.
- Policy "Members read meeting recordings" already calls `is_meeting_member`; **M-A fixes it with no policy change**.
- Policy "Host reads own meeting recordings" is unaffected.
- To confirm in step 0: who writes to this bucket today (no writer was located in the repository), and whether any signed URL is issued from it. If none, the bucket is effectively dormant and the exposure is the rows, not the files.

## 5. Data migration, backfill and compatibility

| Change | Existing data | Backfill |
|---|---|---|
| M-A, M-B, M-E triggers | none changed | none |
| M-C `joined_via` | existing rows get NULL (provenance unknown) | none possible; rotation can only revoke rows created after the code change records `link` |
| M-C expiry | NULL = no expiry (today's behaviour) | none |
| M-D token table | one row per meeting | copy `share_token`; verify counts equal before the column is dropped |
| M-E foreign keys | rows with a dangling `project_id` or `circle_id` would fail validation | add `NOT VALID`, report offenders, clean with approval, then `VALIDATE` |

Bulk modification of production rows is not part of this proposal; offenders are reported first.

## 6. RLS impact by role

| Role | After M-A | After M-B | After M-D | After M-E |
|---|---|---|---|---|
| Host | unchanged | unchanged | reads and rotates the token | context still free for their own meetings, provable |
| Invited / joined / left attendee | unchanged | can only move their own status along the allowed transitions | no longer reads `share_token` | n/a |
| Cohost (role `cohost`) | unchanged (member) | cannot promote themselves | no token | n/a |
| Denied / removed | **loses** meeting, participants, recordings, transcripts, storage and realtime | cannot edit their row | no token | n/a |
| Anonymous guest with link | unchanged until the code change; then bound by expiry | n/a | n/a | n/a |
| Authenticated holder of the link | gains a recorded provenance (`link`) | n/a | n/a | n/a |
| Unrelated user | no access (unchanged) | no access | no access | cannot attach a meeting to someone else's project or Circle by a direct write |
| Service role | unchanged | unchanged (trigger skips it) | unchanged | unchanged |

## 7. Decisions needed from the approver

1. **`knocking` and `left`**: keep them as member-eligible (proposed, matches today's lobby flow), or tighten.
2. **Link expiry**: a default lifetime for new tokens (and its value), or no default.
3. **Cohost**: should a cohost be able to rotate the link or remove people (today only the host can via the policy)?
4. **Canonical transcript store**: `call_transcripts` (creator only, used by the code paths audited) or `meeting_transcripts` (member audience, no writer located). Pick one before anything is written to the other.
5. **Historical participants of project calls**: retain recording access after losing project access (GA SEC-04 leaves it open)?

## 8. Rollout sequence

1. Step 0: capture the live definitions and grants; diff against this document.
2. Deploy the code slices E to I (they are fail-closed and do not depend on the SQL).
3. M-A alone, to staging, two-account test, then production (single function replacement, no table rewrite).
4. M-B, same way.
5. M-E as `NOT VALID`; report offenders; approval; validate.
6. M-C columns and function, then the code change that records provenance and honours expiry, then rotation in the UI.
7. M-D last (it touches four writers and one reader): create table, dual-write, switch readers, drop column.

Each migration is idempotent and applied separately, with the previous definition saved from step 0.

## 9. Rollback

| Migration | Rollback |
|---|---|
| M-A | restore the saved `is_meeting_member` definition (one function) |
| M-B | drop the trigger and function |
| M-C | columns are nullable and unused by old code: leave them; drop the function |
| M-D | keep the old column populated until the switch is verified; reverting readers is a code revert |
| M-E | drop the trigger; drop the foreign keys (they were added `NOT VALID`) |

Soft revocations that were set to `removed` by a rotation cannot be restored to their previous status automatically (the previous status is not stored): record the previous status in the audit trail before running a revoking rotation.

## 10. Tests required before each step

Every test runs for these identities, one meeting with a recording and a transcript: host, cohost, invited attendee, joined attendee, **denied**, **removed**, authenticated link holder, anonymous link holder, unrelated user, service role.

| Check | Expect |
|---|---|
| Read meeting, participants, recordings, transcripts | members yes; denied, removed, unrelated no |
| Storage object read and signed URL issuance | members yes; denied, removed, unrelated no |
| Realtime subscription to the meeting | members receive; a removed user stops receiving after reconnect |
| Update own row: status in the allowed set | allowed |
| Update own row: role, meeting_id, user_id, or out of denied/removed | rejected |
| Read `share_token` | host only |
| Rotate token with and without revoking link attendees | host only; rows revoked as specified; old token refused |
| Direct insert of a meeting with a foreign project or Circle | rejected for a client, allowed for the service role |
| Mint a token after each step | unchanged for allowed identities |

A negative test (access denied) is as required as a positive one.

## 11. Estimated blast radius

- **M-A**: every reader of the four meeting tables and the recordings bucket; users who were denied or removed lose read access (intended). No write path changes.
- **M-B**: only direct client writes to `meeting_participants`; none exist in `src/` today.
- **M-C**: additive; no behaviour change until the code that uses it ships.
- **M-D**: the highest code coupling (four writers, one reader); do last.
- **M-E**: only clients writing `meetings` directly; `StartMeetingDialog` and `PersonalRoom` go through the function, and `TodayStrip` and `BookingPage` only read.

## 12. Not in scope

Payment, payout and provider-state logic; Company workspace and role tables; `call_transcripts` RLS; Circle membership policy (GA SEC-16); any bucket creation. Each needs its own proposal.
