# M-A preflight: `is_meeting_member` (Phase 0, read-only)

Scope: **M-A only** (`is_meeting_member` stops counting `denied` and `removed` participants). M-B to M-E stay pending until this preflight is reviewed. **No migration is written, none is applied, and no DDL appears in this file.** The only SQL below is read-only catalog and count queries (SELECT), for someone with production database access to run and paste the results back.

Related: `schema-policy-impact-meetings.md` (the proposal), `gate-audit-company-experience-execution-matrix.md` (rows 5 and 16).

## 1. What could not be captured from here, and why

I tried the only database connector available in this environment (the Lovable project's cloud database). It is enabled but **empty**: 0 tables in `public`, no `is_meeting_member`, no `meetings`. That matches `AGENTS.md`: production still runs on the legacy backend and Cloud holds only regenerated empty schema files. So the live definition, grants and row counts **cannot be captured by this session**. Everything in section 2 is repository evidence; everything in section 3 needs a person with access to the production (legacy) database.

## 2. Repository evidence (code only, not proof of what is deployed)

### 2.1 The function
Defined once, in `supabase/migrations/20260512184606_bccd1043-1693-478a-85c4-e2a51d0ad478.sql` (no later migration redefines it):

| Property | Value in the migration |
|---|---|
| Signature | `public.is_meeting_member(_meeting_id uuid, _user_id uuid) returns boolean` |
| Language, volatility | `sql`, `stable` |
| Security | `security definer`, `set search_path = public` |
| Body | true if `meetings.host_id = _user_id`, **or** a `meeting_participants` row exists for `(meeting_id, user_id)` with **no status condition** |
| Sibling | `public.is_meeting_host(_meeting_id, _user_id)`: host only, unaffected by M-A |

### 2.2 Everything in the repository that depends on it
All references are in that same migration; none in `src/` or `supabase/functions` (no `.rpc('is_meeting_member')` call anywhere):

| # | Dependent | Kind | Effect of the function today |
|---|---|---|---|
| 1 | `meetings` "Members can view meetings" | SELECT policy | any participant row, any status, can read the meeting (including `share_token`) |
| 2 | `meeting_participants` "Members view participants" | SELECT policy | same, for the participant list |
| 3 | `meeting_recordings` "Members view recordings" | SELECT policy | same, for recordings |
| 4 | `meeting_transcripts` "Members view transcripts" | SELECT policy | same, for transcripts |
| 5 | `storage.objects` "Members read meeting recordings" (bucket `meeting-recordings`, private) | SELECT policy | same, for recording objects |
| 6 | Realtime on `meetings` and `meeting_participants` (`supabase_realtime` publication) | derived | realtime changes are filtered by the same RLS, so they follow 1 and 2 |

Not dependents: `is_meeting_host` policies ("Hosts manage ..." on all four tables), and the edge functions (they use the service role and read `meeting_participants.status` directly: `mint-meeting-token`, `get-recording-link`).

### 2.3 What the generated client types say
`src/integrations/supabase/legacyTypes.ts` lists `is_meeting_member` and `is_meeting_host` among the database functions, i.e. they were visible to the API schema when the types were generated. Combined with a caller-supplied `_user_id` and `security definer`, this is the same shape the 2026-10-09 lockdown migration (`20261009090000_lock_down_public_definer_functions.sql`) addressed for other functions; **that migration does not mention these two**.

## 3. What must be captured live (read-only, to be run by someone with production access)

Every statement below is a SELECT on a catalog or a count. None modifies anything. Run in the production SQL editor, paste the raw results back.

### 3.1 The definition as deployed
```
-- READ-ONLY
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef  as security_definer,
       p.provolatile as volatility,
       p.proconfig  as function_settings,
       pg_get_userbyid(p.proowner) as owner,
       pg_get_functiondef(p.oid)   as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_meeting_member','is_meeting_host');
```

### 3.2 Grants: who can execute it
```
-- READ-ONLY
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_meeting_member','is_meeting_host');
```

### 3.3 Dependencies: every policy, function, trigger or view that mentions it
```
-- READ-ONLY: policies in every schema (storage included)
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where coalesce(qual,'') ilike '%is_meeting_member%' or coalesce(with_check,'') ilike '%is_meeting_member%'
order by schemaname, tablename, policyname;

-- READ-ONLY: other functions that call it
select n.nspname, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ilike '%is_meeting_member%' and p.proname <> 'is_meeting_member';

-- READ-ONLY: views that call it
select schemaname, viewname from pg_views where definition ilike '%is_meeting_member%';

-- READ-ONLY: the realtime publication and the triggers on the participant table
select pubname, schemaname, tablename from pg_publication_tables
where tablename in ('meetings','meeting_participants');
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.meeting_participants'::regclass and not tgisinternal;
```

### 3.4 The policies of the four tables and the bucket, as deployed
```
-- READ-ONLY
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('meetings','meeting_participants','meeting_recordings','meeting_transcripts'))
   or (schemaname = 'storage' and tablename = 'objects' and (coalesce(qual,'') ilike '%meeting-recordings%' or coalesce(with_check,'') ilike '%meeting-recordings%'))
order by schemaname, tablename, policyname;
```

### 3.5 Impact size: who would lose access
```
-- READ-ONLY: participant rows by status
select status, count(*) as rows, count(distinct user_id) as users, count(distinct meeting_id) as meetings
from public.meeting_participants group by status order by rows desc;

-- READ-ONLY: denied or removed people who currently have a recording or transcript behind them
select count(distinct p.user_id) as affected_users, count(distinct p.meeting_id) as affected_meetings
from public.meeting_participants p
where p.status in ('denied','removed')
  and (exists (select 1 from public.meeting_recordings r where r.meeting_id = p.meeting_id)
    or exists (select 1 from public.meeting_transcripts t where t.meeting_id = p.meeting_id));
```
Also record whether anyone **other than the host** is both a `denied`/`removed` participant and the `created_by` of a related call transcript (they would still have access through that path, which M-A does not touch).

## 4. What M-A would change (description only, no SQL)

- One function replaced in place, keeping its name, argument names and types, language, volatility, security attribute and `search_path`: the participant branch gains a status condition excluding `denied` and `removed`. Because the signature is unchanged, **none of the six dependents is recreated**.
- Expected effect: a denied or removed person stops reading the meeting, its participants, recordings, transcripts, recording objects and realtime updates. The host is unaffected. `invited`, `knocking`, `joined` and `left` keep today's access.
- Not changed by M-A: the caller-supplied `_user_id` and the question of who may call the function directly (section 5, Q3), the participant self-update policy (M-B), link rotation (M-C), `share_token` exposure (M-D), context ids (M-E).

## 5. Questions the preflight must answer before M-A is written

| # | Question | Answered by | Why it matters |
|---|---|---|---|
| Q1 | Is the deployed definition identical to the migration (no status condition, same `search_path`)? | 3.1 | If production already differs, M-A may be unnecessary or wrong |
| Q2 | Are there dependents the repository does not know (policies, views, functions, triggers)? | 3.3, 3.4 | They would change behaviour too; the repository search found none |
| Q3 | Can `anon` or `authenticated` call the function directly with an arbitrary `_user_id`? | 3.2 | Then it is a membership oracle for any meeting id. It cannot simply be revoked: policies run it with the caller's privileges, so revoking `authenticated` would break the policies. A guard that ignores a mismatching `_user_id` for non-service callers is the likely shape: that is a design decision, to be settled in review, not in this preflight |
| Q4 | How many people and meetings lose access? | 3.5 | Sizes the blast radius and tells whether anyone needs to be told |
| Q5 | Does anything write to `meeting-recordings` today, and is any signed URL issued from it? | 3.4 plus a look at storage object counts | If dormant, the storage policy fix is theoretical |
| Q6 | Is `knocking` meant to be a member status? | decision | Today it keeps access; M-A keeps it, matching the lobby flow |

## 6. Review criteria (go / no-go for writing M-A)

Go to the migration only when all hold:

- Q1 to Q4 answered from live output, not from the repository.
- The 3.4 output matches the six dependents in 2.2 (or the difference is understood).
- The affected-user count from 3.5 is known, and a decision on notifying them (or not) is recorded.
- The two-account test plan in `schema-policy-impact-meetings.md` section 10 is accepted for M-A, including the negative cases (denied, removed, unrelated user) and a realtime check.
- The previous definition (3.1 output) is saved as the rollback artefact.

## 7. Out of scope here

M-B to M-E; any migration or DDL; any change to grants; any production write; the Company Experience work (it waits on this and the rest of the meeting gates).
