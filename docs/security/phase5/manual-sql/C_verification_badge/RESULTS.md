# Lot C -- results reported by the owner, 2026-11-01

Run in the SQL Editor of "kretopia-app" (production), as `postgres`, with the scripts as corrected in commit 7e4aa4064 (`is_claimed`,
`current_streak` and `daily_swipes` are not in the locked list because the app writes them itself). Pasted into the conversation; the author
did not run anything and has no access to the database.

| Script | Reported result |
|---|---|
| `01_preflight.sql` | `anon_can_update_something_today` false; `authenticated_has_table_level_update_today` false; **`exposed_now` = `last_swipe_reset`, `phone_number`, `phone_otp`, `phone_otp_expires_at`**; `missing_columns` empty; `review_candidates` = `invite_code_used`, `invited_by`, `preferred_currency`, `project_credits`, `referred_by_ambassador`; `rls_enabled` true; `will_keep_update` 113; `will_lose_update` the same four (the paste was cut after `phone_otp_expires_`) |
| `02_apply.sql` | `result` = applied |
| `03_verify.sql` | **9 of 9 checks true**: `anon_cannot_update_anything`, `anon_cannot_write_any_privileged_column`, `enough_privileged_columns_found`, `members_cannot_insert_any_privileged_column`, `members_cannot_update_any_privileged_column`, `no_table_level_update_left_for_members`, `ordinary_columns_still_editable`, `rls_enabled`, `service_role_still_updates_them`. `informational_columns_members_can_update` = 113 |

## What this shows

* **The real exposure was four columns.** Before the lot, a member could write `phone_number`, `phone_otp`, `phone_otp_expires_at` and
  `last_swipe_reset` on their own profile. The first three let a member set their own SMS code and its expiry, so a phone could be
  "verified" without owning it. That is closed. Every other column of the locked list was already denied to members in production, which is
  why the preflight lists only four; the verification, subscription, Stripe, XP and badge columns were not exposed.
* Members now hold UPDATE on 113 ordinary columns only, no table-level UPDATE, and `service_role` still updates the locked ones.

## What it does not show

* How a real signed-in caller is treated: the REST calls at the end of `03_verify.sql` are still owed (a PATCH of a locked column should
  answer permission denied, a PATCH of an ordinary column should succeed).
* That the app still works: a click-through of the profile editor, onboarding, the daily check-in and undo swipe is owed. The scan that kept
  three columns unlocked was static (66 writes to `profiles` in `src/`, edge functions checked for the client they use).

## The five review candidates (members can write them; the lot does not lock them)

| Column | Does the app write it? | Suggested decision |
|---|---|---|
| `preferred_currency` | yes, `src/hooks/useCurrencyConversion.ts` (a display preference) | leave writable |
| `referred_by_ambassador` | yes, `src/lib/ambassadorAttribution.ts` sets it from the browser | any member can attribute themselves to any ambassador. If ambassador rewards depend on it, validate it server side; otherwise leave |
| `project_credits` | no direct writer found | lock it once you have confirmed it is not typed into the profile form |
| `invite_code_used`, `invited_by` | no direct writer found on `profiles` (`invited_by` also names project invitations in 22 files) | lock them once you have confirmed what writes them |

None of these is locked here: locking a column the app writes would answer that flow with HTTP 403. Say the word and the lock for the three
"no writer" columns becomes a small lot of its own.

## Status

Lot C: **applied, catalog-verified, REST calls and click-through owed.**
