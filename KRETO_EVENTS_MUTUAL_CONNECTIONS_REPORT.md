# Events Mutual Connections — P2 Fix Report

Per `KRETO_PLATFORM_ACCELERATION_AUDIT.md` §H: "No 'people you may know' or mutual-connection UI exists today anywhere in Events" and "the dormant `get_mutual_connections` RPC... zero call sites... `CreatorBrowseGrid.tsx` already attempts exactly this and is silently non-functional under RLS."

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`. Live behavior `NOT_CONFIRMED` — needs the migration applied before it can compute anything (see below).

## Root cause confirmed

`CreatorBrowseGrid.tsx` tried to compute mutual connections by querying *other* users' `connections` rows directly (`supabase.from('connections').select(...).in('user_id', visibleIds)`). `connections` RLS only allows a caller to see rows where they are `user_id` or `connected_user_id` — so unless the current user happens to be in `visibleIds`, these queries always returned empty, and `mutual_connections` silently computed to `0` for every creator, every time. The UI badge (`{creator.mutual_connections} mutual`) was already fully built and wired — only the data was wrong.

## Fix

New migration `supabase/migrations/20260905140000_mutual_connections_batch_rpc.sql`:

1. **`get_mutual_connection_counts(p_target_ids uuid[])`** — a new `SECURITY DEFINER` RPC that computes mutual-connection counts (plus up to 3 sample names/avatars) for the calling user against a whole list of target users in one round trip. Derives the caller from `auth.uid()` directly rather than a passed parameter, so it isn't spoofable.
2. **Hardened the existing `get_mutual_connections(user1_id, user2_id)`**: it was `SECURITY DEFINER` with no check that the caller is one of the two users being queried — any authenticated caller could already ask for the mutual-connection list between two arbitrary strangers, an information leak the `connections` table's own RLS would otherwise block. It had zero call sites, so this was dormant, not exploited — closed now, before this migration gives it (and its new sibling) real callers.

Wired into:
- **`CreatorBrowseGrid.tsx`** — replaced the broken direct-query block with one call to `get_mutual_connection_counts`. No UI change; the existing badge now shows a real count.
- **`EventGuestRoster.tsx`** — new: each guest in the roster and the profile-preview sheet now shows a real trust signal ("You know Maya, Jordan +1 more") instead of a plain, context-free list of strangers, using the same RPC.

## Explicitly out of scope for this round

- Scout's "people in your network" signal (audit §I) — a genuinely new UI concept (no existing broken code to fix, unlike Events), not implemented here pending a placement/scope decision.
- `SessionParticipants.tsx` — a host-management view (remove/download/visibility toggle), not a discovery surface; mutual connections didn't seem like a natural fit there and weren't added.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- Both RPC call sites degrade safely if the migration isn't applied yet (`supabase.rpc(...)` returns `data: null` on a missing function, and both call sites already guard on `if (mutualRows)`), so this ships without breaking either page pre-migration.
- Live correctness (`NOT_CONFIRMED`): the RPC doesn't exist in the database until the migration is applied. Needs the same apply-then-curl-verify step as every other migration this session.

## Deployment steps required

1. Merge the PR.
2. Apply `20260905140000_mutual_connections_batch_rpc.sql` via the Lovable Cloud SQL editor.
3. No edge function redeploy needed — this is a database function + two frontend files, no edge function touched.
4. Verify live: as an authenticated test user with at least one accepted connection, confirm `CreatorBrowseGrid`/`EventGuestRoster` show a real mutual count instead of always 0.
