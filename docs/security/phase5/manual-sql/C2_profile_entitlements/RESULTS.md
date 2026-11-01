# Lot C2 -- results reported by the owner, 2026-11-01

Run in the SQL Editor of "kretopia-app" (production), as `postgres`. Pasted into the conversation; the author did not run anything.

| Script | Reported result |
|---|---|
| `01_preflight.sql` | `functions_that_write_them` empty; `informational_columns_members_can_update` 113; `unlisted_denied_columns` = `ambassador_code`, `available_invites`, `icdb_creator_id`, `is_discoverable`, `membership_number`, `storage_limit_bytes`, `storage_used_bytes` (members can neither insert nor update any of them); `writable_today` was cut after `available_invites` (insert false, update false) |
| `02_apply.sql` | `result` = applied |
| `03_verify.sql` | **6 of 6 checks true**: `members_cannot_update_them`, `members_cannot_insert_them`, `anon_cannot_write_them`, `service_role_still_updates_them`, `no_table_level_write_for_members`, `ordinary_columns_still_editable`. `informational_columns_members_can_update` = 110 |

## What this shows

* No function of the database updates the four columns, so nothing that runs as the caller can break.
* `available_invites` was already denied, so the lot changed three columns: members could update 113 columns before and 110 now.
* The seven columns lot C does not name are all denied to members. A scan of `src/` and `supabase/functions` finds no write to any of them, so
  with lot C's 56 and `current_streak` and `is_claimed` all 65 denied columns are now known, and the only browser writes that hit one are the
  two flows that already failed (daily check-in, profile auto-provision).

## What it does not show

How a real signed-in caller is treated over HTTP (the catalog records what PostgREST enforces; no REST call was run).

## Status

Lot C2: **applied and catalog-verified.**
