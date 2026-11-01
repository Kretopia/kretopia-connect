# Lot E -- concurrency and transition test (run by you, on an ISOLATED database, never on production)

Status until this test has been run and matches: **WAITING_FOR_VALIDATION**. Not run by the author (no database, and by rule no `psql`).

What it must show: of many simultaneous consumers of one approved action exactly one wins; two positive approvals cannot coexist; the status
cannot take a path the code never uses; a decided action cannot be rewritten.

## 1. Isolated database and the minimum schema

Same throwaway database and `stubs.sql` as lot A's test (it defines `anon`, `authenticated`, `service_role` and `auth.role()`; also add
`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`).
Then the tables, copied from the repository's migration `20260501201445` (only what the lot touches):

```sql
CREATE TYPE public.orch_risk_level AS ENUM ('safe_auto', 'requires_approval', 'locked');
CREATE TYPE public.orch_action_status AS ENUM ('proposed', 'approved', 'rejected', 'executed', 'failed', 'auto_executed');
CREATE TYPE public.orch_approval_decision AS ENUM ('approved', 'rejected', 'edited');
CREATE TABLE public.orch_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, user_id uuid NOT NULL, tool_name text NOT NULL,
  tool_args jsonb NOT NULL DEFAULT '{}', risk_level public.orch_risk_level NOT NULL DEFAULT 'requires_approval',
  status public.orch_action_status NOT NULL DEFAULT 'proposed', executed_at timestamptz, decided_at timestamptz);
CREATE TABLE public.orch_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_id uuid NOT NULL REFERENCES public.orch_actions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, decision public.orch_approval_decision NOT NULL, edited_args jsonb, decided_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.orch_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own orch approvals" ON public.orch_approvals FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Then `01_preflight.sql`, `02_apply.sql`, `03_verify.sql`.

## 2. Forty consumers of one approved action

```sql
INSERT INTO public.orch_actions (id, run_id, user_id, tool_name, status)
VALUES ('44444444-4444-4444-8444-444444444444', gen_random_uuid(), gen_random_uuid(), 'delete_project', 'approved');
```

`consume.sql` (the exact statement `authorizeHighStakesAction` sends):

```sql
UPDATE public.orch_actions SET status = 'executed', executed_at = now()
WHERE id = '44444444-4444-4444-8444-444444444444' AND status = 'approved' RETURNING id;
```

```bash
pgbench -n -f consume.sql -c 40 -j 8 -t 1 approvals_test
```

Expected: exactly **one** of the 40 returns a row. Check: `SELECT status FROM public.orch_actions WHERE id = '4444...';` is `executed`, and `pgbench -r` shows 1 row returned in total
(or count by sending the 40 results to a log).

## 3. The guard

Each statement below must fail with SQLSTATE 23514 (`ERROR: agent action status cannot go from ...` or `a decided agent action cannot change ...`):

```sql
UPDATE public.orch_actions SET status = 'proposed' WHERE id = '44444444-4444-4444-8444-444444444444';   -- executed -> proposed
UPDATE public.orch_actions SET tool_name = 'send_dm' WHERE id = '44444444-4444-4444-8444-444444444444'; -- rewrite after the decision
UPDATE public.orch_actions SET tool_args = '{"project_id":"other"}' WHERE id = '44444444-4444-4444-8444-444444444444';
-- and with a rejected action: UPDATE ... SET status = 'proposed'  (rejected -> proposed)
```

Each of these must succeed (they are the paths the code uses): `proposed -> approved`, `approved -> executed`, `executed -> approved` (release),
`approved -> proposed` (the orchestrator's compensation when the approval record could not be written), `proposed -> rejected`, `approved -> failed`.

## 4. Two positive approvals

```sql
INSERT INTO public.orch_approvals (action_id, user_id, decision) VALUES ('44444444-4444-4444-8444-444444444444', gen_random_uuid(), 'approved');
INSERT INTO public.orch_approvals (action_id, user_id, decision) VALUES ('44444444-4444-4444-8444-444444444444', gen_random_uuid(), 'edited');   -- must fail: unique index
INSERT INTO public.orch_approvals (action_id, user_id, decision) VALUES ('44444444-4444-4444-8444-444444444444', gen_random_uuid(), 'rejected'); -- must succeed
```

## 5. Own action only (as a member, not as postgres)

```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '<some other uuid>';
INSERT INTO public.orch_approvals (action_id, user_id, decision) VALUES ('44444444-4444-4444-8444-444444444444', '<the same other uuid>', 'rejected');
-- must fail: new row violates row-level security policy (the action is not theirs)
```

(`orch_actions` needs a `SELECT` policy for the policy's sub-query to see the row in a faithful test: copy "Users view own orch actions" from the repository migration.)

## What to report back

Steps 2 to 5: the number of rows returned in step 2, the SQLSTATE of each statement of step 3, the three results of step 4, the error of step 5.

## What the lot does not do

It does not bind an approval to the CONTENT shown to the person (a fingerprint of the arguments or of a draft's text): that needs the proposer to
store one, which is a code change in the orchestrator, not a schema change. The handlers already bind the named targets (project, person, draft).
