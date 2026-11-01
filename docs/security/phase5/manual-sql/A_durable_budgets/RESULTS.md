# Lot A -- results reported by the owner, 2026-11-01

Run by the owner in the SQL Editor of "kretopia-app" (production), as `postgres`, PostgreSQL 17.6. Pasted into the conversation; the author
did not run anything and has no access to the database. The scripts are the ones in this folder, unchanged.

| Script | Reported result |
|---|---|
| `01_preflight.sql` | `roles_present`, `auth_role_function_present`, `gen_random_uuid_present`, `no_table_index_function_or_type_of_these_names`: all **true**. `postgres_version` 17.6, `running_as` postgres |
| `02_apply.sql` | `result` = applied, `next_step` = now run 03_verify.sql |
| `03_verify.sql` | **16 of 16 checks true** (listed below). `informational_rows_in_the_tables_0_right_after_apply` = 0, `informational_running_as` = postgres |

The 16 checks, all true: `two_tables_exist`, `rls_enabled_on_both`, `no_policy_so_clients_are_denied`, `three_functions_exist`,
`all_security_definer`, `search_path_pinned`, `anon_cannot_execute`, `authenticated_cannot_execute`, `service_role_can_execute`,
`public_pseudo_role_cannot_execute`, `clients_have_no_table_privilege`, `service_role_can_read_for_monitoring`,
`counters_move_only_through_the_functions`, `overshoot_is_impossible_by_constraint`, `nine_constraints_present`, `two_indexes_present`.

## What this shows

* The objects exist in the production catalog exactly as designed: two tables with RLS on and no policy, three `SECURITY DEFINER` functions
  with a pinned `search_path`, nine constraints (among them `used + reserved <= limit`), two indexes.
* Who may do what, as the catalog records it: `anon`, `authenticated` and `PUBLIC` cannot execute the functions nor touch the tables;
  `service_role` can execute the functions and read the tables but holds no INSERT, UPDATE, DELETE or TRUNCATE on them.
* `02_apply.sql` ends with `COMMIT` only if its embedded smoke test passed, so it also shows, inside production and with the owner's rights:
  the limit of 2 was enforced, a reservation settles once, released units are available again, a request above the limit is refused, an
  expired reservation is given back. The tables were empty afterwards.

## What this does not show

* **Concurrency.** Many simultaneous callers are not exercised. `05_CONCURRENCY_TEST.md`, on an isolated database, is still owed.
* **How a real caller is treated.** The editor runs as `postgres` and the catalog is read, not exercised. `03b_verify_as_roles.sql` makes
  the database answer as each API role (no key needed); the REST call at the end of `03_verify.sql` is the only look at PostgREST itself.
* **Any protection.** Nothing calls `reserve_budget`, `commit_budget` or `release_budget` (`_shared/durableBudget.ts` has no importer), so
  no function is limited by them yet.

## Status

Lot A: **applied, catalog-verified, unwired.** Its concurrency behaviour is **WAITING_FOR_VALIDATION**; wiring any function to it waits for
that test.
