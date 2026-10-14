# Outbound senders, third pass: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: same as `outbound-senders-security-evidence.md` (#161) and `outbound-senders-review-security-evidence.md` (#162): *what makes Kretopia send a message is triggered by a proven actor, to a recipient the actor is entitled to reach, with a bounded blast radius, once.* This pass closes the senders that the second pass left as the next three: `send-outreach-email`, `send-project-invitation` and `send-event-blast`, plus `send-credit-invite`. Repository findings (code evidence); none was reproduced against production.

## 1. Findings and rules

| # | Function | Finding | Now |
|---|---|---|---|
| S1 | `send-event-blast` | **Any host could mail any user.** An explicit `userIds` list was taken as is: recipients were resolved from `profiles` and `auth.users` for whatever ids the host named. Creating an event is free, so any account could send its own subject, HTML and link, from our domain, to any registered user (ids are public) | the explicit list is intersected with the event's `jam_participants` (RSVPs and ticket holders: the ticket flows upsert it); a host narrows, never widens; a failed audience read answers 503 |
| S2 | `send-project-invitation` | no limit; each call mints a magic link and, for an unknown address, **creates a passwordless account**; access was the SQL helper, which counts any accepted role including a viewer-link guest; the address was unvalidated | one plain address (400 otherwise); accepted owner, collaborator, creative or client via `requireProjectAccess` (an accepted guest is refused); budget 20 per account and 3 per address per hour, read before anything is created; a failed count answers 503 |
| S3 | `send-outreach-email` | no limit on mail leaving from `noreply@kretopia.com`; a linked sequence email could be sent twice (double click, retry, two tabs: it was marked sent only after the send); no body bound | on the platform-domain path only (the user's own Gmail is their own reputation): budget 30 per account and 3 per address per hour, read first; a sequence email is claimed (`pending` or `failed` to `sent`, compare-and-set, caller's own row) before it leaves and released if the send fails, for both `send` and `send_sequence` (409 when lost); body at most 20000 characters; refusals carry their own status (400, 409, 429, 503) instead of 500 |
| S4 | `send-credit-invite` | unbounded `external_collaborators`; addresses unvalidated; project name, role and name handed to the template unclipped | at most 20 per request, one plain address each (an invalid one is reported, not sent), text clipped |

Interim registry for S2 and S3: rows in the existing `email_send_log` with their own template names (`project-invitation-direct`, `outreach-direct`) and the acting user in `metadata.actor_user_id`; `created_at` is indexed. It counts attempts, not deliveries. The durable per-account registry is a schema proposal (`proposal-outbound-send-registry.md`).

New pure helper: `_shared/outboundBudget.ts`. Reused unchanged: `_shared/projectAccess.ts`, `_shared/outboundText.ts` (#161).

## 2. Plaintext credentials and tokens: inventory

Flagged from the migrations and from the senders read in the three passes. "Storage" says what is at rest, not whether production matches the repository.

| Where | What | At rest | Action |
|---|---|---|---|
| `user_email_settings.gmail_app_password` (`send-outreach-email`) | a Gmail app password | **plaintext** | proposal: `proposal-gmail-credential-storage.md` |
| `connected_platforms.access_token`, `refresh_token` | OAuth tokens of Spotify, YouTube, Instagram and others | column comment says "encrypted in practice"; the column is plain `TEXT`; not verified | read-only check, then the same proposal |
| `oauth_apps.client_secret` (default `encode(gen_random_bytes(32))`) | an app secret | plaintext until the 2026-09-10 rotation migration, which adds `client_secret_hash` and nulls the value | verify the migration was applied |
| `profiles.phone_otp` | one-time code | hashed by #162 once pasted; plain until then | paste #162 |
| `marketplace_orders.download_urls` | 7-day signed URLs (webhook) | persisted bearer links | `schema-policy-impact-commerce.md` C-E |
| `meetings.share_token`, `project_share_links.token`, `guest_studio_tokens`, `project_guest_links`, `video_call_guest_tokens`, `credit_endorsements.token`, `icdb_brand_verifications.verification_token`, `opportunities.verification_token`, `claim_token` (revoked from clients) | bearer tokens | plaintext (a hash would not allow the host to re-show a link; the protection is length, expiry and revocation) | per-token expiry and rotation: `schema-policy-impact-meetings.md` M-C and M-D |
| `account_merge_requests.*_otp_hash`, `guest_wallet_email_codes.code_hash` | one-time codes | hashed | none |

## 3. Tests

`src/lib/__tests__/outboundBudget.test.ts`: 15 passing. The budget decision (under, at and over each limit, either count unreadable, the documented constants); the registry helpers against a recording stand-in (filters by template, actor and recipient; a failed count is null, never zero; the written row carries the actor and a unique message id; a failed write is reported). Wiring: access and address validation precede the budget and the budget precedes the link mint; the platform budget sits after the Gmail branch and before the Resend send; the sequence claim precedes the send and is released on failure (twice); the blast intersects with the audience and no longer filters the raw list; the credit invite is capped and validated. ESLint clean. Not run: a two-account test against a real backend.

After the paste:

| Request | Expected |
|---|---|
| host of event E, `send-event-blast` with `userIds` containing a user who is not on E | that user is not mailed; the blast goes to the participants in the list |
| accepted guest, `send-project-invitation` | **403** |
| owner, 21st invitation in an hour, or a 4th to one address | **429**, no link minted, no account created |
| `send-outreach-email` `send` with the same `sequenceEmailId` twice | 200, then **409**, one mail |
| `send-outreach-email` over 30 platform-domain mails in an hour | **429** (Gmail sends are not counted) |
| `send-credit-invite` with 25 collaborators | the first 20 are processed |

## 4. Behaviour changes to be aware of

- Accepted **guests** can no longer send project invitations (they could mint sign-in links). Owner, collaborators, creatives and clients still can.
- A host's custom segment can no longer include a user who is not on the event's participant list.
- A sequence email that is neither `pending` nor `failed` can no longer be sent from the outreach tab.

## 5. Remaining gaps (not addressed here)

- The registry is `email_send_log` metadata, not a purpose-built table: no index on the actor, no daily or monthly window beyond what a query scans, and a failed insert is not retried. The proposal covers it.
- `send-event-blast` still resolves emails through `listUsers({ perPage: 1000 })`: participants beyond the first 1000 accounts are silently dropped (a correctness bug, not an access one).
- `send-event-invite` mails up to 500 addresses per request to people who are not users; there is no per-event or per-day cap.
- `send-user-email` and `send-transactional-email` keep the 2026-10-09 policy modules; their caps are per recipient, not per account.
- The Gmail path sends from the user's own mailbox with no cap of ours, by design.

## 6. Rollback

Re-paste the previous function. `_shared/outboundBudget.ts` can stay: only the two functions import it. Registry rows written under the two template names are harmless and can be left.

## 7. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/outboundText.ts` (from #161), `_shared/projectAccess.ts` | already in the bundle | not deployed |
| `_shared/outboundBudget.ts` | before the two functions that import it | not deployed |
| `send-project-invitation`, `send-outreach-email` | after the helper | not deployed |
| `send-event-blast`, `send-credit-invite` | no new import beyond `outboundText.ts` (credit invite) | not deployed |

Checksums at this commit: `outboundBudget.ts` `1971365fc9717274df729474a20b08a2e35fbe4bffb9cbf8205bcb840cd80715`, `send-project-invitation` `8f93947be6c5b003748c85400aef65930d99890e043c29895760939145b879af`, `send-outreach-email` `0944a58f2ddf69abd90b60bdf2014e69728afb85e701ec3594e521f9e16eb149`, `send-event-blast` `1c757bb0fb795536727c934099685f5ee83e74a50a7be4136d17496cbb33a386`, `send-credit-invite` `2c6109d462732c2ecd1f00cfe460d92b6b3f54b169d131a69d2f8493913a8c36`.
