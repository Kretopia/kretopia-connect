# Duplicate leads already in `public.leads` — read-only report

Status: **query ready, not yet run against the real database. This document contains no counts on purpose.**
Written 2026-10-06. Companion file: [`leads-duplicates-report.sql`](./leads-duplicates-report.sql).

## Why there are no numbers here

The Lead Scout fix (PR #68, `fix/lead-scout-duplicates`) stops *new* duplicates. It does nothing for rows
that were saved twice before it, and that data lives only in the production database.

When this was written, the Supabase connector available to the authoring session listed 14 projects, **all
paused (`INACTIVE`)**, none named Kretopia. Restoring a paused project is a billable change outside this task,
so no live query was run and nothing below is a measurement. Run the SQL where you have access to the
production database and read the results with the notes below.

## What it checks

"Same lead" is the rule the app now uses (`supabase/functions/_shared/leadExtraction.ts`), applied **per user**,
ignoring case and surrounding spaces: **same email**, or **same name + same company**. The oldest row
(`created_at`, then `id`) is the original; every later match is a *later copy*.

| Query | Answers |
|---|---|
| 0 | How big is `leads`: totals, users, rows with no email/company, auto-saved vs button-saved. |
| 1 | **Headline:** later copies by confidence, with users affected. |
| 2 | The groups to review: ids, sources, dates, whether any copy was already worked, linked outreach sequences. |
| 3 | The 50 users with the most likely copies. |
| 4 | Later copies by week of creation: should fall to ~0 for weeks after the fix is deployed. |

Confidence, strongest first:

- **high** — same email. Almost always the same person.
- **medium** — same name + same non-empty company.
- **low** — same name with no company, or the placeholder name `unknown` (`scout-leads` writes it when a result
  has no name). Two different people called "John Smith" look identical here. Never treat this bucket as
  duplicates without a look.

Query 2's `scout_autosave_plus_button = true` marks the exact bug PR #68 closes: a lead saved automatically by the
search (`source` starts with `thrive-research:`) and again by Save / Save All (`source = 'AI Scout'`). Those pairs
are the safest to believe. `rows_with_progress > 0` means someone already worked one of the copies (stage past
`cold`, contacted, or follow-up set), and `linked_sequences > 0` means an `outreach_sequences` row points at it.

## What this cannot tell you

- "Ann Lee" and "Ann M. Lee", or the same person with two different emails, are **not** detected: matching is
  exact after case/space normalisation.
- One shared email (e.g. `info@company.com`) can belong to several real contacts: check high-confidence groups
  whose rows have different names before treating them as copies.
- Query 2's `copies` is group size; a group of N rows is N−1 later copies. Use query 1 for totals. A pair that
  matches on email and on name+company is counted once there.
- Postgres `lower()` / whitespace trimming can differ from JavaScript `toLowerCase()` / `trim()` on unusual Unicode.
- Query 2 prints other people's emails and names. Keep the output private, or wrap `key_value` in `md5()` to share.

## If you then want them merged (proposal only — nothing here does it)

No `UPDATE` or `DELETE` is included, deliberately. A safe merge would be a separate, approved step:

1. Export the rows from query 2 (or back them up) first; nothing here is restorable once deleted.
2. High and medium only, **per user**, in a transaction. Low confidence is reviewed by hand.
3. Keep the oldest row — or the copy with progress if only a later one was worked. Fill the keeper's empty
   fields (email, company, role, profile URL, notes) from the copies it absorbs.
4. Repoint `outreach_sequences.lead_id` to the keeper **before** deleting. That foreign key is
   `ON DELETE SET NULL`, so deleting a linked copy would silently unlink its sequence.
5. Re-run queries 1–2; high and medium should be 0.

Separately, a database-level guarantee (a partial unique index on `(user_id, lower(btrim(email)))` where the email
is non-empty) cannot be created while high-confidence duplicates exist, so this report is its prerequisite. It would
be a migration and needs its own schema impact report and approval. Name + company should stay an app-level rule.

## What was verified

- The SQL ran against a **throwaway local Postgres 16** with a synthetic `leads` / `outreach_sequences` schema copied
  from migration `20260211174626` and 20 made-up rows covering: case/space-different emails, a triple, name+company,
  name-only, the `unknown` placeholder, same name at different companies, empty-string emails, the same email under a
  different user, a worked copy, and a linked sequence. All four queries returned the counts the fixture was built
  to produce, including no cross-user matches and no double listing in query 2.
- A scan of the file finds no write statements outside comments.
- **Not verified:** any real data, performance on the real table size (it uses window functions, no self-join, and
  `leads` has no index on `user_id` in its original migration, so expect a full scan), and whether the live table
  matches the repo: no migration in `supabase/migrations` alters `leads` after its creation, but production
  is the legacy backend and was not inspected.
