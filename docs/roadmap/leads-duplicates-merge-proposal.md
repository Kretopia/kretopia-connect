# Merging the duplicate leads — proposal

Status: **proposal, not approved, nothing has been run against real data.**
Written 2026-10-06. Follows [`leads-duplicates-report.md`](./leads-duplicates-report.md), which counts the duplicates.

| File | What it is |
|---|---|
| [`leads-duplicates-merge-preview.sql`](./leads-duplicates-merge-preview.sql) | **Read-only.** Shows exactly what the merge would do (P1), the backup export (P2) and the groups left for a person (P3). |
| [`leads-duplicates-merge.PROPOSED.sql`](./leads-duplicates-merge.PROPOSED.sql) | **Changes data.** The merge itself. Ends in `ROLLBACK` and refuses to run until a count is typed in. Do not run before approval. |

## What it does

For each user, folds each set of duplicate leads into one row, in two phases:

1. **`email`**: same email **and** the same name.
2. **`name_company`**: same name + same non-empty company, with no two different emails.

Per group it **keeps one row** (the one that was ever worked, otherwise the oldest), **fills that row's empty fields**
(email, company, role, notes, profile URL, avatar) from the others, **unions the tags**, **re-points any outreach
sequence** to it, then **deletes the others**.

It never merges: low-confidence matches (same name with no company, the placeholder `unknown`), people with
the same name at different companies, rows of different users, or any group where a rule below trips. Those are
listed by preview query P3 for a person to look at.

## Why these rules

- **Same name required for email groups.** A shared inbox (`info@…`) can belong to several real contacts.
- **Different emails block a name + company match.** Two contacts with the same name at one company may be two people.
- **Different type blocks a merge.** `client` vs `collaborator` is a decision someone made.
- **Two worked copies block a merge.** Only one stage / follow-up history can survive; a person should choose.
- **Re-pointing outreach sequences is mandatory.** `outreach_sequences.lead_id` is `ON DELETE SET NULL`, and the
  outreach functions read the recipient's email through it (`process-outreach-queue`, `send-outreach-email`):
  deleting a linked copy would leave the sequence with no recipient. It is the only table in this repo's migrations
  that stores a lead id (production is the legacy backend and wasn't inspected).

## Decisions I need from you

1. **Keeper:** worked row first, else oldest. OK?
2. **Notes:** the keeper's notes win; a copy's different notes are **not** carried over (they stay only in the
   backup). The alternative is to append them, which edits what people wrote. Which do you prefer?
3. **Shared-inbox and different-name groups** go to manual review instead of auto-merging. OK, or do you want
   them merged by email anyway?
4. **Who runs it, and when.** It needs a connection that can write to the production database, and it takes a short
   write lock on `leads`, so run it off-peak. I can't run it from here (the Supabase connector only lists paused projects).

## Before anything runs

- [ ] The Lead Scout fix (#70) is **deployed**, not just merged: otherwise the next search recreates duplicates.
      Report query 4 should show no new copies after the deploy.
- [ ] Report query 1 has been run and the numbers look right to you. I haven't seen any real count.
- [ ] You approve the four decisions above.

## Runbook (per phase; phase `email` first)

1. In **all three** preview queries, set `key_type` to the phase and run them. Read **P1**: only its `merge` row
   would change anything. Skim **P3** for what is being left alone.
2. **Back up:** run **P2** and save the result (CSV/JSON) somewhere private, not in this repo (it holds other people's
   contact details). Every removed or changed lead and every re-pointed sequence is in it, whole.
3. **Dry run:** in the merge script set `key_type` and `expected_copies` (P1's `later_copies` for `merge`), and run it
   unchanged, with `psql -v ON_ERROR_STOP=1`. It ends in `ROLLBACK` and prints "N copies folded into M keepers; K
   sequences re-pointed". Nothing is saved. (psql shows that notice; the Supabase SQL editor may not.)
4. **Apply:** change the last line from `ROLLBACK;` to `COMMIT;` and run again.
5. Re-run the preview: the `merge` row should be gone. Re-run report queries 1–2.
6. Repeat with `name_company` (re-run the preview first: phase 1 changed the table).
7. Hand the P3 list to whoever should look at it.

## Safety properties

- **Dry-run by default:** the script ends in `ROLLBACK`.
- **Won't run blind:** it stops unless `expected_copies` equals the number of copies the live data produces now. If
  anyone added or merged rows since the preview, or `key_type` doesn't match, it refuses.
- **Every step asserts its row counts** (keepers updated, sequences re-pointed, nothing still pointing at a copy,
  copies deleted); any mismatch raises and undoes everything. If it errors and a later `COMMIT` still runs,
  Postgres turns that `COMMIT` into a rollback.
- **Single transaction**, with a short write lock on `leads` so nothing is added or edited mid-run.
- **No schema change:** temporary tables only; no other table is touched except `outreach_sequences.lead_id`.
- Idempotent in effect: after a successful run the plan is empty, so running it again stops at the guard.

## What was tested

On a **throwaway local Postgres 16** with the real table definitions and 32 made-up leads (+4 sequences):

| Case | Result |
|---|---|
| Script run as written (no count set) | Refused; fingerprint of both tables unchanged |
| Wrong `expected_copies` with `COMMIT` | Aborted; unchanged. Also unchanged when run without stop-on-error (the `COMMIT` became a rollback) |
| Correct count, ending in `ROLLBACK` | Printed the counts; unchanged |
| Phase `email`, `COMMIT` | 32 → 26 leads; 5 groups / 6 copies merged (one group of three) and 3 sequences re-pointed (one linked to a copy, two to copies of a triple); the worked later copy became the keeper; keeper's blank company/role filled from the copy while its own notes stayed; tags unioned; all 4 sequences kept and re-pointed (none orphaned); the other user's identical email untouched |
| Phase `name_company`, `COMMIT` | 26 → 24; keeper without an email received the copy's email |
| Held back | shared inbox with two names, two worked rows, client vs collaborator, same name + company with two emails: all left alone; "John Smith" with no company, `unknown`/Globex and same-name-different-company: never touched |

The preview's three queries agreed with what the script then did (6 copies, 3 sequences in phase 1; 2 copies in phase 2).

**Not tested:** any real data; how long it takes on the real table (it scans `leads` and takes a lock); the Supabase SQL
editor's handling of a multi-statement transaction; and **restoring from the backup**. I have not written a restore
script: if you approve the merge I suggest I write one and rehearse it on a copy first, because the backup is the only
way back.

## Not part of this proposal

- No unique index on leads: it needs its own schema impact report and approval, and can only be created once the
  `email` phase has run and the manual list is resolved.
- No change to the app. Near-duplicates such as "Ann Lee" vs "Ann M. Lee" are not detected and stay as they are.
