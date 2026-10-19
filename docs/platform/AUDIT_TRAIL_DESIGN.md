# Audit trail design

Status: design only. `audit_events` does not exist (checked in the repo and in production on 2026-10-19), so nothing is created or applied here. Any table, trigger, or grant below needs a written schema-impact report and explicit approval first.

## What exists today
`import_audit_log` (imports only), `creative_actions` (via `log_creative_action`), `orch_actions` (agent actions, `_shared/agentAuthority.ts`), `stripe_webhook_events` (Stripe ledger), `client_error_logs`, and the function `log_grant_revoke_on_sensitive_tables` (no trigger attached). There is no single, append-only record of who did what to which object. Recording access, credit changes, and role changes leave no durable trace.

## Model: `audit_events` (append-only)
| Field | Type | Rule |
|---|---|---|
| `id` | uuid | primary key |
| `created_at` | timestamptz | server time, never client time |
| `actor_id` | uuid, nullable | the user; null for system |
| `actor_kind` | text | `user`, `system`, `webhook`, `cron`, `admin` |
| `action` | text | `<domain>.<verb>`, from the fixed list below |
| `object_type` | text | table or concept, for example `call_transcript` |
| `object_id` | text | the row id |
| `scope_id` | uuid, nullable | project or meeting the object belongs to |
| `outcome` | text | `ok`, `denied`, `failed` |
| `before` / `after` | jsonb, nullable | **changed fields only**, from a per-action allow-list |
| `metadata` | jsonb | request id, function name, provider event id, reason code |

Never stored: passwords, tokens, signed URLs, API keys, message bodies, transcripts, bank details, full emails or phone numbers (store a hash or the user id), IP addresses (store a coarse country if needed).

## Append-only enforcement
- Clients get no policy for INSERT, UPDATE, or DELETE. Writes go through one SECURITY DEFINER function, executable by `service_role` only, with a pinned `search_path`.
- A trigger rejects UPDATE and DELETE for every role except a retention job.
- Optional tamper evidence: `prev_hash` and `hash` per `scope_id` (SHA-256 over the previous hash and the row); verify weekly.
- Partition by month; keep 13 months hot, then archive to a private bucket.

## Who can read
Admins: all. A user: events where `actor_id` is theirs. A project owner: events with their `scope_id`, excluding other users' `metadata`. Anonymous: none.

## Priority events and where to emit
| Action | Emitter |
|---|---|
| `recording.access` (granted and denied) | `get-recording-link` |
| `recording.stored`, `recording.transcript_skipped` | `daily-recording-webhook`, `sync-daily-recordings`, `transcribe-call` |
| `credit.created`, `credit.verified`, `credit.disputed` | `verify-credit`, `verify-brand-credit`, credit RPCs |
| `cosign.requested`, `cosign.accepted` | `send-credit-invite`, `vouch_on_credit` |
| `passport.updated`, `passport.shared` | profile writes, `auto-epk-updater` |
| `member.invited`, `member.accepted`, `member.role_changed`, `member.removed` | `project_collaborators` and `meeting_participants` triggers |
| `webhook.received`, `webhook.failed` | the six webhook functions (provider event id in `metadata`) |
| `admin.action` | every `admin_*` RPC |
| `project.owner_changed` | trigger on `projects.created_by` (see `SECURITY_BASELINE.md`) |

## Rollout
1. Approve the schema-impact report. 2. Create the table and writer function. 3. Wire the recording and webhook emitters first (they already have the ids). 4. Add member and role triggers. 5. Add credit and Passport emitters. 6. Admin read view. 7. Weekly hash verification.

## Rollback
Stop calling the writer function (feature flag in each emitter). The table is inert and can stay or be dropped; no product behaviour depends on it.
