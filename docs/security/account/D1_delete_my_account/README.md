# LOT D1: a member can delete their own account

**Status: prepared, rehearsed on a scratch Postgres 16 (repository schema), NOT applied to kretopia-app.** Paste it in the SQL Editor
of kretopia-app, which needs no Lovable credits and no deployment. The app change ships separately and only works once this is applied.

## The gap
Settings > Data & Apps > Delete Account (`src/pages/Settings.tsx`, `src/components/profile/SettingsTab.tsx`) called
`supabase.auth.admin.deleteUser(user.id)` from the browser. The admin API needs the service-role key, so production answers
`403 {"code":"not_admin"}` and the member sees "Failed to delete account". Seen on www.kretopia.com on 2026-11-26. Nobody can delete their
account (finding DP-01, `docs/security-compliance/data-protection-review.md`).

## What it changes
`02_apply.sql` (one transaction, stops if a prerequisite is missing) adds **one function** and changes nothing else:

`public.delete_my_account()`: `SECURITY DEFINER`, `search_path = public, auth, pg_temp`, no arguments (it can only ever act on
`auth.uid()`), `EXECUTE` for `authenticated` only (not `anon`, not `PUBLIC`). In order:
1. no signed-in user: error `not_authenticated`;
2. every **nullable** column that points at the member with `NO ACTION`/`RESTRICT` is set to `NULL` (read from the catalog, so it follows
   production, not the repository): `invites.used_by`, `profiles.invited_by`/`claimed_by`, `milestones.paid_to`/`requested_by`,
   `*.reviewed_by`, `support_*`, `opportunities.scouted_by`, ... The other member's record stays, only the pointer goes;
3. deletes the member's `profiles` row (`user_id = auth.uid()`), which cascades through the foreign keys to the profile's dependants.
   **This is explicit on purpose**: migration `20251229182924` dropped `profiles_user_id_fkey` (unclaimed profiles), so deleting only the
   login would leave the profile, bio, avatar and its data behind;
4. deletes the `auth.users` row (sessions, identities and the tables that cascade from it go with it);
5. a foreign-key violation anywhere (a NOT NULL reference such as `milestones.created_by`) raises `account_delete_blocked`; the whole call,
   including step 2, is rolled back, and the detail is written to the Postgres log, not sent to the member.

## Order
`01_preflight.sql` (read-only) → `02_apply.sql` → `03_verify.sql` (no FAIL; one WARN is expected, see below) → test by hand.
Rollback: `04_rollback.sql` (drops the function; the button fails again; **it does not bring back deleted accounts**).

Read the preflight first: `blocker:` lines are members who cannot delete yet (`account_delete_blocked`), `INFO` lines count what is
left behind (next section). Apply is safe either way.

## By hand (the real proof, with a QA account that has some data)
1. Apply, run `03_verify.sql`.
2. Ship the app change. Sign in as a QA account, Settings > Data & Apps > Delete Account > confirm: toast "Account deleted", back on `/`.
3. In the SQL Editor: `select count(*) from auth.users where email = '<qa email>';` and
   `select count(*) from public.profiles where user_id = '<qa user id>';` → both `0`.
4. Signing in again with that email must fail.
5. A QA account with a NOT NULL blocker should get the "could not delete" toast and still exist afterwards.

## Rehearsal
Scratch Postgres 16 with stubbed Supabase roles/`auth`/`storage`, all 804 migrations replayed. 247 statements failed in the replay (mostly
realtime publications and extensions the stub lacks, and tables production has but no migration creates), so the schema is close to
production, not identical. In the scratch copy one profile trigger (`trg_sync_profile_to_split`) had a type mismatch from that drift and was
disabled for the run; the fixtures were inserted with triggers off.
- anon: permission denied. Signed in but no uid: `not_authenticated`.
- A member with a NOT NULL `milestones.created_by` row in someone else's project: `account_delete_blocked`; login, profile and the
  invite pointer are all still there (nothing partial).
- A member with an invite used, a profile that invited someone, a milestone paid to them, and a review on their profile: login and
  profile gone, review gone (cascade), the other member kept with `invited_by` cleared, the invite and milestone kept with the pointer
  cleared, other members untouched.
- Second call with the same (now stale) session: `account_not_found`. Rollback removes the function; apply again restores it.
- Not covered by the rehearsal: production's real triggers and data volume.

## Not covered. Read this before telling members "your data is deleted"
This lot makes the button work and removes the login, the profile and what cascades from them. It is **not** a full erasure:
1. **About 170 tables keep their rows.** They hold `user_id`/`created_by`/`buyer_id`/... with **no foreign key** (the preflight counts them),
   among them `wallets`, `transactions`, `credits`, `payment_history`, `creator_payouts`, `ai_conversations`, `orch_*`, `community_posts`,
   `event_orders`. After deletion those rows stay, keyed to a login that no longer exists. Sweeping them is a separate lot and needs a
   decision per table, because some are accounting records and some are shared with other members.
2. **Money.** Deleting the profile cascades to `wallet_transfers`, `wallet_topups`, `manual_bank_transfers`, `payment_disputes`,
   `recipient_bank_accounts` (counter-parties lose their copy of a transfer) and a wallet balance is lost with the account. Whether
   accounting records must be kept (and for how long) is the owner's/legal's call; the function does not decide it. The preflight
   counts wallets with a balance above zero.
3. **Stripe.** No subscription, customer or Connect account is cancelled. A member with a paid plan can keep being billed. Either have them
   cancel first, or add a guard in a follow-up.
4. **Files.** Storage objects (avatars, uploads, recordings) are not removed: SQL can't delete the blobs, only the Storage API can
   (needs an edge function or a service-role script).
5. **Claimed source profiles** (imported pages a member claimed: `profiles.claimed_by`) stay with the pointer cleared.
6. **Triggers.** Step 2 is an `UPDATE`, so row triggers on those tables run. A trigger that refuses updates would make the delete fail
   (the member sees the generic failure toast and nothing is changed). None is known; the preflight can't see it.
7. **The dialog copy** still says "remove all your data". Until 1 to 4 are handled that is stronger than what happens; the owner should
   decide the wording.

## Known limits
- Not run against production data: kretopia-app's actual constraints could differ from the repository's. The apply's own checks and the
  preflight stop or warn in that case.
- The function can't tell a hijacked session from the member: anything that can call it as the member can delete the account. The UI
  asks for confirmation; there is no re-authentication step.
- `03_verify.sql` does not call the function (it would delete a login); the by-hand test is the end-to-end proof.
