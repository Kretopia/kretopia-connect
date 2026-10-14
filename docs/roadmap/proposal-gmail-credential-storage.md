# Proposal: secure storage of the Gmail app password (and third-party OAuth tokens)

Proposal only. **Nothing here was applied, and nothing here is runnable.** The statement sketches use `<PLACEHOLDER>` tokens and will fail if pasted. No secret is created, read or shown by this document: creating the key it asks for is an approval-gated step performed by the owner.

Covers the plaintext-credential finding of the second and third outbound passes. Matrix rows 5 and 18; the program rule "flag every sender that stores credentials, tokens or secrets in plaintext".

## 0. Prerequisite: capture the live state (read-only)

- the definition, policies and grants of `user_email_settings` and `connected_platforms`;
- counts (numbers only, never values): rows with a non-null `gmail_app_password`; rows of `connected_platforms` by `platform` with a non-null `access_token` or `refresh_token`; whether those values look like ciphertext (length and prefix class only) or plain tokens;
- whether a secret-store or encryption extension is enabled on the production database, and its owner.

## 1. Objects affected and current unsafe behaviour

| # | Object | Behaviour today (repository evidence) |
|---|---|---|
| G-A | `user_email_settings.gmail_app_password` | a Gmail app password in a plain `TEXT` column. The policy "Users manage own email settings" is `FOR ALL` on `user_id = auth.uid()`, so the **owner can read it back through the data API**, and the outreach screens (`GmailSettings.tsx`, `useOutreachData.ts`) call `select("*")`, which loads it into the browser's query cache on every visit. The UI never reads it: it only sends it to `send-outreach-email` |
| G-B | `send-outreach-email` | reads the password with the service role and connects to `smtp.gmail.com:465` as the user. A password with Gmail's send scope is the user's whole mailbox send capability, and an app password also works for IMAP |
| G-C | `connected_platforms.access_token`, `refresh_token` | OAuth tokens of Spotify, YouTube, Instagram and others in plain `TEXT` (the migration comment says "encrypted in practice"; the column is not typed or constrained as such) |
| G-D | `oauth_apps.client_secret` | generated in plaintext; the 2026-09-10 rotation migration adds `client_secret_hash` and nulls the value: confirm it ran |

## 2. Target

1. A credential is never returned to a browser or a client query, by any role, including its owner. The UI learns only "connected, as who, last tested when".
2. At rest it is ciphertext under a key the database does not hold, with a key version, so it can be rotated.
3. Only the sending function decrypts it, with the service role, for the moment of use.
4. Disconnect removes the ciphertext, not just the flag.
5. A failure to decrypt is a refusal to send, never a fallback.

## 3. Options

| Option | What it is | Cost and risk | Verdict |
|---|---|---|---|
| A | Stop storing the app password: send outreach through the platform's mail provider with the user's address as Reply-To (already the fallback path) | no credential to protect; mail leaves from our domain (budget applies) and the user loses "sent from my own Gmail" | simplest; a product loss |
| B | Application-level envelope encryption: AES-GCM in the edge function, key from one new function secret, ciphertext and `key_version` in the row | needs one new secret (owner-created); no new provider; decrypt only in the sender | **recommended** |
| C | Database secret store (a vault extension) | depends on the extension being available and on who can read its decrypted view | only if the preflight shows it is enabled and locked down |
| D | Google OAuth with the send scope instead of an app password | revokable by the user at Google, no password stored, but needs a Google OAuth client and token storage (the same problem again) | later; a provider integration decision |

## 4. Migration sketches (NOT RUNNABLE, for review of intent only), option B

```
-- G-1  columns for ciphertext                                    [fixes G-A at rest]
-- NOT RUNNABLE
ALTER TABLE public.user_email_settings
  ADD COLUMN <gmail_credential_ciphertext> text NULL,
  ADD COLUMN <gmail_credential_key_version> int NULL
-- the plaintext column stays during the transition, then is emptied by the code path, then dropped
```

```
-- G-2  the client can no longer read the credential               [fixes G-A in transit]
-- NOT RUNNABLE
-- Option 1 (recommended): column-level privileges. REVOKE SELECT on the credential columns from
--   authenticated and anon; GRANT SELECT on the remaining columns. Any `select *` by a client
--   then fails with a permission error, so the two screens switch to explicit column lists first
--   (a frontend PR that can ship immediately and is harmless on its own).
-- Option 2: move the credential to a separate table with no client policy.
```

Code that goes with it (separate PRs, after approval): the connect action encrypts before writing and writes null to the plaintext column; `send-outreach-email` decrypts, and on first use of a legacy plaintext row re-encrypts it and nulls the plaintext (lazy migration, no bulk write); disconnect nulls the ciphertext; the same helper later wraps `connected_platforms` tokens.

## 5. Data migration, backfill and compatibility

| Item | Plan |
|---|---|
| Existing plaintext rows | migrated **lazily** on their next use, one row at a time, by the sender. No bulk update of production records |
| Rows never used again | a report (counts) and a notification to those users to reconnect; after a stated date the plaintext is nulled by a reviewed one-off |
| Frontend | the two `select("*")` calls become explicit column lists; this can ship before any SQL |
| Compatibility | users do not re-enter their password; the connect form is unchanged |

## 6. RLS impact by role

| Role | Before | After |
|---|---|---|
| anonymous | no access | no access |
| owner (authenticated) | reads and writes own row, **including the password** | reads own row without the credential; may write a new one |
| another authenticated user | no access | no access |
| service role | full | decrypts in the sender only |

## 7. Decisions needed from the approver

1. **Option.** A (drop the feature), B (recommended), C, or D.
2. **The key.** Approve creating one function secret for option B. The owner creates it; it is never printed in a chat or committed.
3. **Re-connect window.** For rows that are not used again, how long before the plaintext is nulled.
4. **Scope.** Whether `connected_platforms` tokens follow in the same release or after.

## 8. Rollout sequence

1. Section 0 capture (read-only, counts only).
2. Frontend PR: explicit column lists (no SQL, ships on publish).
3. Migration G-1 (additive).
4. Helper and sender PRs (encrypt on connect, decrypt on use, lazy re-encrypt, disconnect nulls). Paste manually.
5. G-2 (revoke the column) only after the frontend of step 2 is published and observed.
6. Report, notification, dated cleanup of the remaining plaintext.

## 9. Rollback

Steps 2 and 4 are reverted by re-publishing or re-pasting. G-1 is additive. G-2 is reverted by granting the column back from the captured privileges. Never roll back by re-writing plaintext from ciphertext without the owner.

## 10. Tests required before each step

Roles: the owner, a second user, anonymous, the service role.

| Case | Expected |
|---|---|
| owner loads the outreach screens | no credential field in any response or in the query cache |
| owner reads the row through the data API after G-2 | the credential columns are refused |
| a second user reads the owner's row | refused (unchanged) |
| connect, then send | the ciphertext is stored, the plaintext is null, the mail sends |
| a legacy plaintext row, first send | sends, then the row holds ciphertext and a null plaintext |
| a wrong or rotated key | the send is refused, no fallback to plaintext, no secret in the log |
| disconnect | both columns null, `is_configured = false` |

## 11. Estimated blast radius

Frontend step: very low. G-1: none. Sender change: every user who has connected Gmail (the count from section 0): a bug blocks their outreach, never exposes it. G-2: any other reader of the table breaks loudly (only the two known screens use it).

## 12. Not in scope

Rotating users' Google app passwords (only they can), the OAuth redirect flows of the connected platforms, `oauth_apps` client secret rotation (already migrated, to confirm), the bearer-token inventory (meeting, share and guest tokens: `schema-policy-impact-meetings.md`).
