# Lot 0 — SEC-01 / SEC-02: what the catalog proves, what needs a real JWT

Nothing was re-applied and nothing was run: this session has no database access (by your rule). The two fixes were applied by
you in the SQL Editor; this file only closes the verification. Everything below that is not marked "from the repo" is **your
statement**, not something I observed.

## 1. Run this first

`lot0_sec01_sec02_catalog_check.sql` — one read-only statement, one result, in the SQL Editor of **kretopia-app**.
Paste the result back and the rows below are checked against it. A missing object appears as an explicit `*_missing` row.

## 2. What the result proves (pass criteria, row by row)

| Row | Pass when | Why |
|---|---|---|
| `function` | `exec_anon=false`, `exec_authenticated=true`, `exec_service_role=true`, `security_definer=true`, `proconfig` holds a `search_path=…` | SEC-01. The repo body (migration `20260417183206`) lets a caller with `auth.uid() IS NULL` through, and anon has `auth.uid() IS NULL`: the privilege revoke is what closes anon, the body is the second line. |
| `function_definition` | the body refuses a signed-in non-admin **and** requires the service role explicitly (not merely "no `auth.uid()`") | A body that only tests `auth.uid() IS NULL` would admit anyone who regains EXECUTE later. Read the `RAISE`: its `ERRCODE` decides the HTTP code of call 2. |
| `table` | `rls_enabled=true` | Policies do nothing while RLS is off. |
| `policy` | an INSERT policy whose `with_check` is `(auth.uid() = created_by)` **and no other permissive INSERT/ALL policy** | Permissive policies are OR-ed: one leftover `WITH CHECK (true)` (the repo has had several, see migrations `20251005*`) defeats the strengthened policy. This is the row most likely to hide a problem. |
| `trigger` | every guard row has `enabled = 'O'`; the definitions show the timing and columns | A trigger shown as `D` is present but silent. |

Expected triggers **from the repo** (`supabase/migrations`): `set_project_created_by_trigger` (BEFORE INSERT, rewrites
`created_by := auth.uid()`, migration `20260524111719`), `trg_assign_project_recap_token` (BEFORE INSERT),
`update_projects_updated_at` (BEFORE UPDATE), `trg_guard_project_created_by` (BEFORE UPDATE OF `created_by`, `20261019120000`),
`trg_guard_project_payer_columns` (`20261020130000`), `trg_guard_project_owner_columns` (`20261021100000`), plus AFTER triggers.
You count **four** BEFORE UPDATE guards; the repo accounts for three of them. The fourth is not in any repo migration, so the
result row is the only place its name and definition will appear.

## 3. What the catalog cannot prove — only a real JWT can

* That `auth.uid()` returns the caller under PostgREST. In the SQL Editor it is `NULL` and RLS is bypassed (it runs as `postgres`).
* That anon and a non-admin are refused **end to end** (grants + body + PostgREST role switch).
* That the guard triggers raise for a signed-in caller. Every guard is skipped when `auth.uid() IS NULL` **by design** (edge
  functions with the service role, and the SQL Editor): a trigger that exists and is enabled has still not been seen to refuse anyone.
* That nothing else grants a path: table privileges for `anon`/`authenticated`, SECURITY DEFINER functions that write `projects`.

## 4. The four REST calls

Placeholders: `URL` = the production project URL; `ANON` = its publishable anon key; `TOKEN_A` = the access token of a normal,
**non-admin** test user A; `UID_B` = the uuid of a second test user B (never a real member). Never paste a key or token into a chat.

**Call 1 — anonymous caller, SEC-01**
```
POST {URL}/rest/v1/rpc/admin_set_profile_coords
apikey: {ANON}
Authorization: Bearer {ANON}
Content-Type: application/json

{"coords": []}
```
Expected **401**, `{"code":"42501", … "message":"permission denied for function admin_set_profile_coords"}`.
`200` = EXECUTE is still open to anon (SEC-01 not closed). `404` / `PGRST202` = the function is missing or its signature changed.

**Call 2 — signed-in non-admin, SEC-01**
```
POST {URL}/rest/v1/rpc/admin_set_profile_coords
apikey: {ANON}
Authorization: Bearer {TOKEN_A}
Content-Type: application/json

{"coords": []}
```
Expected **400** `{"code":"P0001", … "message":"Not authorized"}` if the applied body keeps the repo's plain `RAISE EXCEPTION`;
**403** `{"code":"42501", …}` if it raises with `ERRCODE '42501'`. Read the `function_definition` row to know which. Either is a
pass. `200` is a fail. The empty array makes the probe harmless even if it fails: no profile can change.

**Call 3 — INSERT with someone else's owner, SEC-02**
```
POST {URL}/rest/v1/projects
apikey: {ANON}
Authorization: Bearer {TOKEN_A}
Content-Type: application/json
Prefer: return=representation

{"title": "SEC-02 probe - delete me", "created_by": "{UID_B}"}
```
The BEFORE INSERT trigger runs **before** the RLS check and rewrites `created_by` to the caller, so with
`set_project_created_by_trigger` enabled the expected answer is **201** with `[0].created_by` equal to **A**, never B.
Without that trigger the strengthened policy answers **403** `{"code":"42501", … "new row violates row-level security policy for table \"projects\""}`.
Fail = a 201 whose `created_by` is B. Keep the returned `id` as `PROJECT_ID`.

**Call 4 — change the owner AFTER the insert, SEC-02 (the UPDATE case)**
`trg_guard_project_created_by` is `BEFORE UPDATE OF created_by`: it never fires on an insert, so the insert path in call 3 and this
path are two different defences and need two different tests.
```
PATCH {URL}/rest/v1/projects?id=eq.{PROJECT_ID}
apikey: {ANON}
Authorization: Bearer {TOKEN_A}
Content-Type: application/json
Prefer: return=representation

{"created_by": "{UID_B}"}
```
Expected **400** `{"code":"P0001", … "message":"projects.created_by is immutable"}`. Then
`GET {URL}/rest/v1/projects?id=eq.{PROJECT_ID}&select=id,created_by` (token A) must still show **A**.
Fail = `200` with `created_by` = B (ownership moved). A `200` with `[]` means the row was not visible (wrong id): inconclusive, not a pass.

Clean-up, not a test: `DELETE {URL}/rest/v1/projects?id=eq.{PROJECT_ID}` with token A (the probe is A's own row; if the delete
policy refuses, remove it from the app).

## 5. Reading the four answers together

| Call | Pass | Fail |
|---|---|---|
| 1 anon → RPC | 401 `42501` | 200, or any body that reports a count |
| 2 non-admin → RPC | 400 `Not authorized` or 403 `42501` | 200 |
| 3 foreign `created_by` on INSERT | 201 with caller's id, or 403 `42501` | 201 with B's id |
| 4 owner change on UPDATE | 400 `projects.created_by is immutable`, GET still A | 200 with B's id |

A pass on all four is a proof for **these two surfaces and these two test accounts**, in production, at the time of the calls.
It says nothing about the other `public` functions or tables.

## Results reported by the owner, 2026-11-01 (the catalog query only, not the REST calls)

* **SEC-01 is closed in the catalog.** `admin_set_profile_coords(jsonb)`: `anon` cannot execute it, `authenticated` and `service_role` can, it is
  `SECURITY DEFINER` with `search_path = pg_catalog, public, pg_temp`, and its body refuses anyone who is neither the service role nor an admin
  (and refuses arrays of more than 1000 records). REST calls 1 and 2 would show the HTTP answers; they were not reported.
* **SEC-02 is half seen.** `public.projects` has RLS on (not forced) and one INSERT policy, `Authenticated users can create projects`, with
  `WITH CHECK (auth.uid() = created_by)`, and no other INSERT or ALL policy. A `BEFORE INSERT` trigger (`set_project_created_by_trigger`) and a
  `BEFORE UPDATE OF created_by` trigger (`trg_guard_project_created_by`) exist and are enabled, next to the owner-column and payer-column guards.
  Not seen yet: the bodies of those two trigger functions and the UPDATE policies. `lot0b_sec02_guard_and_counters.sql` (read-only) shows them.
