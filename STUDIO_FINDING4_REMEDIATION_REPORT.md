# Studio Finding 4 Remediation Report

**Status: `BLOCKED_MIGRATION_NOT_APPLIED`**

Remediation for `STUDIO_CURRENT_STATE_AUDIT.md` §7 finding 4 (public
Studio-recap RLS broader than its own field allowlist). Migration:
[`20260825110000_close_public_recap_rls_gap.sql`](supabase/migrations/20260825110000_close_public_recap_rls_gap.sql).
Nothing has been applied.

## The vulnerability, confirmed by reading the live migration

`get_public_studio_recap(token)` (`20260612214115_25e73cb5-...sql:47-135`)
is a well-built RPC — it returns only an explicit allowlist of fields
(project title/description/cover/status/dates, owner/collaborator
public profile fields, milestone title/status/dates, deliverable
title/status/moodboard). No financial column is in that allowlist.

The same migration also added, directly on `public.projects`:

```sql
CREATE POLICY "Anyone can view published recaps"
ON public.projects FOR SELECT TO anon, authenticated
USING (recap_published = true);
GRANT SELECT ON public.projects TO anon;
```

This grants full-row `SELECT` — every column, including `client_price`,
`creative_payout`, `margin_type`, `margin_value` (added later),
`client_user_id`, `agent_user_id`, `video_room_url` — to anyone,
unauthenticated, for any project with `recap_published = true`. No
`recap_token` is checked by this policy at all; the boolean flag alone
is sufficient. Since the Supabase anon key is necessarily public
(shipped in the frontend bundle), any client can skip the token-gated
RPC entirely:

```
supabase.from('projects').select('*').eq('recap_published', true)
```

The RPC's careful allowlist was never actually a security boundary —
this policy made it optional.

## The fix

Two statements: drop the policy, revoke the `anon` grant. That's the
whole migration. `get_public_studio_recap` needs neither — it's
`SECURITY DEFINER`, so its own internal read of `projects` runs as the
function owner, not as the caller, and was never relying on this
policy or grant in the first place.

## Why this is safe — checked before writing the migration, not assumed

- Grepped every migration for `recap_published`/`recap_token`: only
  `20260612214115_...sql` ever touches them. Nothing else depends on
  this specific policy.
- Grepped `src/pages/StudioRecap.tsx` (the only frontend consumer of
  published recaps): it calls the RPC only, never queries `projects`
  directly. Removing the policy changes nothing about what the actual
  recap page does.
- Postgres RLS policies are OR'd together. Every other `SELECT` policy
  on `projects` (the `user_has_project_access`-based ones real project
  members rely on) is untouched — this migration removes exactly one
  policy that granted *more* access than a member's own membership
  already does, nothing else.

## Verification

No SQL applied. No live query run against the database — the safety
argument above is based on reading the tracked migration history and
the frontend consumer's source, the same standard used for every other
"why this won't break anything" claim this session, not a live check
(there is no live-query access available in this session; applying and
verifying is the user's manual step, same as every other migration
prepared this session).

## What would close this out

1. User applies the migration via Lovable Cloud SQL Editor.
2. Postflight query:
   ```sql
   select policyname from pg_policies
   where schemaname = 'public' and tablename = 'projects'
     and policyname = 'Anyone can view published recaps';
   -- Expected: zero rows.

   select grantee from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'projects'
     and grantee = 'anon' and privilege_type = 'SELECT';
   -- Expected: zero rows.
   ```
3. Real client-path negative test: with no auth token at all (anon key
   only), attempt `GET /rest/v1/projects?recap_published=eq.true&select=*`
   directly. Expect `403`/`42501`, not a 200 with project rows.
4. Positive-path re-test: open a real published recap page
   (`/studio/:token`) as a logged-out visitor and confirm it still
   renders correctly via the RPC — this migration must not break the
   feature it's meant to still work for.

None of these four have been run.
