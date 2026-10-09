# Studio + Passport security audit, 2026-10-09

Scope: the "Kretopia_Studio_Passport_Security_UX" brief (14 Studio + 16 Passport rows), checked against the
code in this repo **and** the production database (`kwmcocsitwssrtzkdojh`), read-only. Nothing here was
applied to production by the audit; every database change ships as a migration file that you apply.

**Rollout status, 2026-10-09 night** (verified read-only against production with `verify-2026-10-09.sql`):
migrations 0000, 0100, 0200 and 0300 are applied (27/27 server-only functions closed, 14 `*_impl` closed, 17 wrappers
conform, 4/4 open policies gone, a pending invitee gains no access from the invitation); the frontend that uses the
claim RPCs is published. Still to apply: 0400 (now safe), the cron secret headers, and the edge-function pastes
(`edge-deploy-guide-2026-10-09.md`).

Method (repeatable, see `verify-2026-10-09.sql`): `has_function_privilege('anon', …)` over every SECURITY
DEFINER function, `pg_policies` for world-writable policies, `storage.buckets` / `storage.objects` policies,
anon-key PostgREST probes that print only counts and column names (never values), and a static scan of the
316 edge functions for service-role use without a caller check.

## Why one root cause explains most of it

Every function in `public` is executable by `anon` and `authenticated` by default, the anon key ships in the
app bundle, and ~100 `SECURITY DEFINER` functions had **no identity check**. Anyone on the internet could call
`/rest/v1/rpc/<name>`. Row-level security protects tables, but not these functions, which run as the owner.

## Apply order

1. `20261009090000` lock down definer functions · `…0100` close open write policies · `…0300` event-claim RPCs
   (all additive or revoking; no data change). Then run `verify-2026-10-09.sql`: every row `ok = true`.
2. `20261009090200` Studio access (pending invitees). Apply separately, then smoke-test with two accounts.
3. Publish the frontend (`/claim-event/<token>` now uses the RPCs). Check `www.kretopia.com/version.json` changed.
4. `20261009090400` drops the old claim policies (only after step 3).
5. Edge functions and cron: see "Edge layer" below (manual paste into kretopia-app).

Rollback: `rollback-2026-10-09.sql`. Prefer fixing forward.

## Findings, by priority

Severity: **C** critical (anonymous, no account) · **H** high (any signed-in user or one leaked id) ·
**M** medium · **L** low. Status: **PR** fixed in this PR (needs applying) · **Open** decision or later PR.

| ID | Sev | Brief row | What was possible (verified) | Fix | Status |
|---|---|---|---|---|---|
| F01 | C | Studio 15 | `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` callable by anyone: send mail from our domain, read queued mail (links, PII), drop mail | server-only | PR 0000 |
| F02 | C | Passport 2 | `merge_user_data(a,b)` anyone: move any account's credits, awards, press, connections, notifications into another | server-only | PR 0000 |
| F03 | C | Studio 15 | `match_copilot_memories(user_id, embedding)` anyone: read any user's private Kreto memory | server-only | PR 0000 |
| F04 | C | Passport 3 | `create_bidirectional_connection(a,b,'accepted')` forged a connection; the profiles RLS then gives the forger the other's full profile row (the 2026-09-04 policy fix had left this RPC open) | consent evidence, one-way request otherwise | PR 0000 |
| F05 | C | Passport 2, 5 | `find_matching_unclaimed_profiles` handed out `claim_token`s; `claim_profile(token, ANY user id)` overwrote that user's profile | no token, self-only | PR 0000 |
| F06 | C | Passport 3 | `create_notification(any user, any text, any link)`: phishing inside the product | link allow-list, caps, flood guard | PR 0000 |
| F07 | C | Studio 5, Passport 9 | Storage: anonymous write/delete in `opportunities`, anonymous insert in private `deal-memos`, any user deletes `media/circles/*` | policies dropped / owner-only | PR 0100 |
| F08 | C | Studio 7 | `share_link_approvals` INSERT `WITH CHECK (true)`: forge a client approval for any link/deliverable, even view-only or expired | writer is the edge function only | PR 0100 |
| F09 | C | Studio 5 | `list_share_link_files` skipped the share-link password (anon RPC) | server-only | PR 0000 |
| F10 | C | Studio 6 | `user_has_project_access` counted **pending** invitees: 16 people in 9 projects could read, edit and delete files of a Studio they never joined; an invitee could also write `role='owner'` while accepting | accepted-only + guards | PR 0200 |
| F11 | H | Studio 8 | `send-transactional-email` open relay: verify_jwt passes the public anon key, any template, recipient and data | caller + template rules | Open (PR B) |
| F12 | H | Studio 8 | Unguarded cron-driven functions callable by anyone (`process-outreach-queue`, `process-scheduled-campaigns`, `stage-reminders`, `speed-session-*`, `send-streak-warning`, …) | `requireAdminOrCron` + cron header | Open (PR B) |
| F13 | H | Passport 3 | `universal-search`: no auth, service role, ignores `is_discoverable` and location privacy | public view + auth | Open (PR B) |
| F14 | H | Passport 2 | Any signed-in user could claim any unclaimed event (policy had no token check); tokens listable by anon | RPC by token | PR 0300 + 0400 |
| F15 | H | Passport 2 | invite codes: anyone minted codes, validated them (8-hex brute force), or set a badge on any user via `use_invite_code(…, user_id)` | self-only, new-account-only | PR 0000 |
| F16 | H | Passport 3 | `claim_guest_rsvps(email, any user)` hijacks a guest's event passes; `find_duplicate_account_candidates` leaks phone-match; `get_network_*`/`get_profiles_by_degree`/`get_connection_path` read anyone's graph | server-only / self-only | PR 0000 |
| F17 | M | Studio 5 | `get_or_create_guest_token_for_invite(project, email)` mints a guest token for anyone who knows a project id and an invited email (no proof of the email) | bind to the invitation secret | Open |
| F18 | M | Studio 5 | `get_guest_files` returns every project file to a guest token, not only the shared item | scope the token | Open |
| F19 | M | Passport 3, 9 | `credits` is world-readable (incl. `payment_verified`, `client_brand`, evidence links) and has no visibility flag | visibility column + view | Open (schema) |
| F20 | M | Passport 9 | `portfolio` bucket is public: evidence uploaded there is public by URL | private bucket + signed URLs | Open |
| F21 | M | Studio 7 | Approvals are not bound to a version; a later upload keeps the "approved" status | version in approval | Open (PR C) |
| F22 | M | Studio 8, Passport 17 | No idempotency on approvals/invitations: double click = two rows | de-dupe in the writer | Open (PR C) |
| F23 | M | — | `partner_invite_links` world-readable (codes, contact fields), read by nothing | policy dropped | PR 0400 |
| F24 | M | Passport 8 | "Is this you?" claims an imported profile (and its credits) from a name similarity alone | email/domain proof or claim request | Open (product) |
| F25 | L | — | Open INSERT policies (analytics, error logs, guest RSVP, newsletter): spam surface | rate limit at the edge | Open |
| F26 | L | Studio 5 | Share-link password has no attempt limit | limiter in the edge function | Open (PR B) |
| F27 | L | — | Tokens from `md5(random())` (claim token fixed in 0300; invite/review defaults need `ALTER TABLE`) | crypto RNG defaults | Partly |

## The 30 rows of the brief

Status key: **Fixed** in these migrations (apply them) · **Found** verified, fix is in a later PR or needs your decision ·
**Not audited yet** (UX rows, covered in the follow-up PR) · **OK** checked and fine.

Studio: **1 Drafts/autosave** Not audited yet · **2 Uploads** Found: `project-files` has no size or type limit, and the
other buckets either; resume/retry Not audited yet · **3 Expired sessions** Not audited yet · **4 Concurrent edits**
Not audited yet · **5 Sharing** Fixed F08, F09; Found F17, F18 · **6 Roles/revoked access** Fixed F10; Found: RLS does not
read `role` (except milestone money), needs a role matrix · **7 Client approvals** Fixed F08; Found F21 (no version
binding) · **8 Retries/idempotency** Found F11, F22 · **9 Accurate action states** Fixed: the gig claim page
reported success when RLS matched 0 rows (now checks the rows returned, like the event claim); rest Not audited yet · **10 Undo/restore**
Not audited yet (version tables exist) · **11 Kreto proposals** Fixed F03 (memory read); approval-gating of `desk-agent`
was verified on 2026-10-06, not re-checked today · **12 Activity history** Not audited yet · **13 Wrap/credits/invoice**
Not audited yet · **14 Accessible recovery** Not audited yet.

Passport: **1 Draft vs published** Not audited yet (no draft state seen on `credits`) · **2 Ownership** Fixed F02, F05,
F14; Found F24 · **3 Visibility/contact** Fixed F04, F06; Found F13, F19 · **4 Evidence labels** OK (shared
`classifyCreditEvidence`, earlier PR) · **5 Collaborator confirmation** Fixed F05; confirmation bound to claim version
Not audited yet · **6/9 Confidential evidence** Found F20 (public `portfolio` bucket); `dispute-evidence` is private OK ·
**7 Editing confirmed claims** a DB guard exists (`app.credit_verification_authorized`), invalidation rules Not audited yet ·
**8 Disputes** evidence bucket private OK, rate limit Not audited yet · **10 Kreto suggestions** OK (`approve_discovered_credit`
keeps `auto_discovered`, never `verified`) · **11 Share links/QR** event pass QR OK (earlier work); revocation of a passport
share token Not audited yet · **12/13/14** Not audited yet · **15 Export/deletion** Not audited yet.

## What this PR deliberately does not do

* Change the Studio role model (needs your role matrix: who may delete files, approve, see money).
* Move evidence out of the public `portfolio` bucket or add a credit visibility column (schema + migration of data).
* Touch secrets, auth providers, payments, or Lovable Cloud standby.
* Apply anything to production.

## Edge layer (manual paste, Verify JWT unchanged)

See the follow-up PR: `send-transactional-email`, `universal-search`, `redeem-project-share`, the cron-driven
functions and the matching `x-cron-secret` header SQL for cron jobs 13-16, 22, 28, 30, 33, 36, 41-44.

## Standing recommendation

Make new functions private by default, so this class of hole cannot reappear:
`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;`
then `GRANT` explicitly where a public endpoint is intended. Not applied: it changes what the Lovable agent's
future migrations can assume, so it needs your decision and a smoke test of the public pages first.
