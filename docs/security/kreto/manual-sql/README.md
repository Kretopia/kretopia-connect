# Kreto SQL pack: the migrations approved on 2026-11-21

Four lots, written for review: none of them has been applied anywhere except a throwaway local database (below). They are the
migrations listed in rows 4, 5, 7, 8 and 9 of `docs/kreto/KRETO_VALIDATION.md`. They follow the layout and rules of
`docs/security/phase5/manual-sql/` (same habits, same SQL Editor, read that README's "Where, how" first).

## Where, how

* Only in the SQL Editor of the Lovable project **kretopia-app** (the one that reaches production). Never in "Kretopia Connect": its
  database is a different one and the preflights stop there because the tables are missing.
* One lot at a time, files in numeric order: `01_preflight` (read-only) → `02_apply` (one transaction) → `03_verify` (read-only) →
  `04_rollback` (only if needed). Stop at the first error: an error in an apply script means nothing was changed.
* Paste each result back before the next step. Every verify script says what it proves and what it does not: the SQL Editor runs as
  `postgres` and bypasses RLS, so each one ends with the REST call or app check that proves the member-facing behaviour.
* These are paste scripts, not files under `supabase/migrations/`, on purpose: nothing syncs or applies them by itself.

## The lots

| Lot | Folder | What it does | Effect on what is deployed today | Rollback |
|---|---|---|---|---|
| K1 | `K1_append_only_history` | Members can no longer insert `orch_runs` or `orch_approvals`, update or delete `copilot_plans`, or delete `agent_project_context` (policies dropped, matching member privileges revoked). Members keep reading their own rows. | None expected: every writer in the repository uses the service role, and the app only reads these tables. A hand-pasted function that writes them with a member's token would start failing; the preflight lists the functions that write them. | Recreates exactly the policies and grants it removed, from the copy it kept in `kreto_migration_backup` |
| K2 | `K2_statuses_run_metadata` | Action statuses `unknown` ("not confirmed") and `cancelled`, run status `partial`; lot E's guard gains four paths (proposed → unknown/cancelled, approved → unknown, unknown → executed/failed); `orch_runs.profile` and `orch_runs.effort` (`model`/`tool_names` too, only if migration 20260915100000 never reached production) | None: nothing writes the new values until the code that uses them is deployed. Every path lot E allows stays allowed. **Requires lot E** (applied 2026-11-01). | Restores lot E's guard and drops the two columns. PostgreSQL cannot remove an enum label: the three labels stay, unused. Refuses while rows use them |
| K3 | `K3_tool_registry_tiers` | Raises `orch_tool_registry.risk_level` to the policy floor of `_shared/kretoToolPolicy.ts` (generated from it at `f0e38a101`): 33 tools ask first, `delete_project`, `charge_card` and `refresh_profile` are locked, a tool the policy does not know asks. Never lowers a row | **Immediate, no deploy needed**: the orchestrator deployed in production reads only the registry, so the raised tools stop running on their own and come back as approval cards, and the locked ones are no longer offered. This is the policy's main safety gain, in production, without deploying any code | Puts each row back to its recorded tier, except a row someone changed since (listed) |
| K4 | `K4_thread_summary_web_consent` | New `ai_conversation_summaries` (server writes, owner reads, deleted with the conversation, owner forced from the conversation by a trigger) and `orch_settings.web_research_consent` (`ask` default, `allow`, `off`) | None: nothing reads or writes either object until the code change that uses them | Drops both. Refuses while a member has chosen `allow` or `off`, so a choice is never discarded silently |

The lots are independent, except K2, which needs lot E. K1 and K3 share `public.kreto_migration_backup` (RLS on, no policy, no member
privilege): it holds what an apply removed or changed, and the last rollback drops it. Suggested order: **K3 first** (it brings the
production orchestrator to the policy today), then K1, K2, K4. K2 and K4 only matter once their code is deployed; that code comes in
its own pull request after the lot is applied.

## What was checked, and what was not

* **Rehearsed on a throwaway PostgreSQL 16** (local, in the session's scratch space, deleted with it): a stub of these tables, policies,
  enums and default Supabase grants copied from the repository migrations, with lot E's own `02_apply.sql` applied on top. For each lot:
  preflight → apply → verify (all PASS) → real member attempts with `SET ROLE authenticated` and a JWT subject → a second apply (refused)
  → rollback → verify (FAIL where expected) → apply again. Then all four applied together (32 checks PASS) and rolled back in reverse
  order, back to the starting policies. The rehearsal caught one bug before commit (a PL/pgSQL condition naming the backup table before
  it existed).
* **Not checked against production.** Production may differ from the repository migrations, which is why every apply starts with
  assertions that stop it on anything unexpected, and why every preflight lists what it will touch. Run the preflight and read it first.
* **Not checked:** the code that will write the K2 statuses and columns and use the K4 table and setting. It does not exist yet.
