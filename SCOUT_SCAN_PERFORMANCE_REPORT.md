# Scout — Caching and Scan Performance Report

Two separate problems, two separate fixes.

## Problem 1: results not visible until fetch completes

`ScoutedGigsSection.tsx`, `ShortlistedGigs.tsx`, and `OpportunitiesFeed.tsx`
(the three tabs behind `/opportunities` and Scout) each did a plain
`useState`/`useEffect` fetch on every mount — no cache survived a remount,
so every visit showed a full skeleton before anything rendered, despite the
app already having `@tanstack/react-query` configured globally
(`staleTime: 5min`, `gcTime: 10min` — `src/App.tsx:181-185`) and used
correctly elsewhere (`src/hooks/useClients.ts`).

**Fix**: migrated all three to `useQuery`, following `useClients.ts`'s
pattern exactly. Mutations (dismiss/save/unsave) now update the query cache
directly via `queryClient.setQueryData` instead of local component state;
`scanNow` and the post-dialog's success callback invalidate/refetch instead
of calling a local `load()`.

**Live-verified**, not just by code review: instrumented `window.fetch` to
log every `scouted_gigs`/`scouted_gig_actions` request, navigated from
Opportunities to Home and back via real in-app navigation (not a full page
reload, which would reset the in-memory cache and prove nothing). Result:
**zero new network requests** on the second visit, content rendered
instantly with the same real data (a live "Pitching Forum x MTN
Presentation" gig card), confirming the cache is genuinely serving instead
of silently refetching in the background.

## Problem 2: Scan Now takes over two minutes

`supabase/functions/scout-gigs/index.ts` fanned out to up to ~57 search
queries through a `for` loop that `await`ed each 4-query `Promise.all`
batch sequentially (≈15 round trips), with **no timeout anywhere** on
either the Firecrawl search calls or the final AI-extraction call — a
single slow or dead source (a hung ATS or Instagram scrape) could stall
its batch indefinitely, and every batch after it.

**Fix**:
- `firecrawlSearch` now aborts via `AbortController` after 9s per call —
  a timed-out or dead source returns "no results" for that one query
  instead of hanging the run.
- The extraction AI call (`extractAndScore`) now aborts after 25s for the
  same reason — the second unbounded blocking phase the audit flagged.
- The main search loop now uses `Promise.allSettled` (a rejected promise
  can no longer take down its whole batch) with batches of 12 instead of
  4 — since each call is now individually time-bounded, wider batches are
  safe and cut the number of sequential round trips roughly 3x, from ~15
  batches down to ~5 for a full 57-query run.
- Fixed a real, separate bug found in passing: the free-tier weekly-scan
  gate queried `scouted_gigs.created_at`, a column that doesn't exist on
  that table (it only has `scouted_at`/`expires_at`) — the query was
  silently failing every time, defeating the "1 free preview per week"
  cap. Now queries `scouted_at`, the correct column.

**Not implemented this pass**: true streaming/progressive results (the
function still returns one combined response only after all batches and
the AI extraction finish) and the UI's `scan_clicked`/`source_started`/
etc. instrumentation events from the spec's §11 — those would require a
larger response-shape change (SSE or chunked responses) that goes beyond a
contained performance fix. The realistic new worst case is roughly the
timeout budget times the number of batches (5 batches × ~9-25s) rather
than the previous unbounded hang, which directly addresses the reported
"more than two minutes" complaint, but "first useful result within one
second" (the spec's stretch target) is not achieved — that needs the
streaming architecture change, which is a larger, separate piece of work.

## Verified

- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
- `npx eslint` on all four changed files — the only remaining `any` is a
  single like-for-like carry-over from the original `OpportunitiesFeed.tsx`
  code (`(data as any[])` → `(rows as any[])`, same pattern, not new).
- Edge Function syntax/brace-balance checked (no local Deno runtime
  available, same limitation as every other Edge Function change in this
  project) — **not deployed, not live-load-tested**. I don't deploy Edge
  Functions; the Scan Now timing improvement can only be confirmed live
  once this is deployed and a real scan is run against it.
