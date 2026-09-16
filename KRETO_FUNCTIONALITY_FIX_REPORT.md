# Kreto Functionality — P0 Fix Report

Scope: the 3 root-cause candidates identified in `KRETO_PLATFORM_ACCELERATION_AUDIT.md` §A/§C, specific to the `/kreto` page's `InlineKretoChat` component. `ThriveAgentFab` (the other Kreto surface) already handled all three correctly and was not modified — this report closes the gap between them, not a rewrite of either.

**Tag legend:** `IMPLEMENTED` / `TYPECHECKED` / `BROWSER_VERIFIED` / `NOT_CONFIRMED` — per the brief's required vocabulary.

## Fix 1 — Raw `<action>`/`<plan>` tag leakage

**Root cause:** the shared backend (`thrive-ai-chat`) always instructs the model to emit `<action>{...}</action>` / `<plan>{...}</plan>` tags, for every surface including `"home"` (what `InlineKretoChat` sends). `ThriveAgentFab` strips these live via its own `stripTagsLive` helper; `InlineKretoChat` had no equivalent and rendered the raw tag text verbatim whenever the model proposed an action.

**Fix:** added an identical `stripTagsLive` function to `src/components/kreto/InlineKretoChat.tsx` (same regex approach — remove fully-closed tags, then truncate at any half-streamed opening tag so partial JSON/XML never flashes mid-stream), applied to every streamed delta before it reaches `messages` state.

**After a response completes**, `extractActions()` (already exported from `src/lib/thriveCopilot.ts`, unmodified) is run on the full accumulated text. If it finds a proposed action or plan, the page does **not** attempt to execute it — `InlineKretoChat` has no approval-card UI, and building full parity with `ThriveAgentFab`'s action/plan execution pipeline (activity tracking, `sendAgentIntent`, `copilot-planner` invocation, result cards) is a materially larger feature, not a P0 bug fix. Per the brief's own rule ("must not pretend to perform actions that are not available"), the page instead shows an honest note pointing the user at the surface that can actually execute and approve it: *"I've got a suggested action ready — open the full Copilot (bottom nav) to review and approve it."* This is a deliberate, scoped decision, not an oversight — flagging it here so it isn't mistaken for full feature parity.

`IMPLEMENTED`, `TYPECHECKED`. `BROWSER_VERIFIED`: partial — confirmed the component renders and no console errors appear; could not trigger an actual action-proposing response to see the live strip/redirect-note behavior, since `/kreto` shows a "Sign up to unlock" gate for anonymous visitors and no test account was available in this environment. `NOT_CONFIRMED` for the live tag-stripping and redirect-note behavior specifically — needs a real account to exercise a message that provokes a tool proposal.

## Fix 2 — No conversation persistence/rehydration on `/kreto`

**Root cause:** the backend already persists every turn to `ai_conversations`/`ai_messages`, and `loadCopilotHistory()` already exists and is already called by `ThriveAgentFab` on open. `InlineKretoChat` never called it — `messages` state always initialized to `[]`, silently losing the visible thread on every refresh even though the database row survived.

**Fix:** added a mount-time effect calling `loadCopilotHistory()` (unmodified, reused as-is) and seeding `messages` state with the result when non-empty. Added a small `historyLoaded` flag with a lightweight "Loading your conversation…" indicator so the composer doesn't flash an empty state before history resolves.

`IMPLEMENTED`, `TYPECHECKED`. `BROWSER_VERIFIED`: the effect correctly resolves to an empty array for an anonymous session (confirmed via console — no exception, `loadCopilotHistory()`'s own `if (!user) return []` guard handles this safely) — but the actual "message survives a refresh" behavior needs a real account with an existing conversation to verify. `NOT_CONFIRMED` for the authenticated case.

## Fix 3 — Unguarded async paths could leave a permanently-stuck spinner

**Root cause:** `thriveCopilot.ts`'s `getSession()` call and its SSE reader loop are not wrapped in try/catch inside the shared client; a thrown rejection from either only reached a bare `.catch((e) => console.error(...))` at the `InlineKretoChat` call site, which never touched `messages` state. Since the loading spinner is keyed on `!m.content`, an empty assistant bubble stayed stuck forever with no visible error and no timeout.

**Fix:** wrapped the entire `await streamCopilot(...)` call (plus the post-stream action-detection check) in `InlineKretoChat.tsx` in a try/catch/finally — mirroring the exact pattern already proven in `ThriveAgentFab.tsx`'s own `send()` function (`try { await streamCopilot(...); ...} catch (e) { toast.error(...); } finally { abortRef.current = null; }`), adapted to this page's own inline-bubble UI instead of a toast. The catch block explicitly distinguishes an intentional Stop-button abort (`e instanceof DOMException && e.name === "AbortError"`) — which is silently ignored, matching the brief's "ignore expected cancellation errors" instruction — from a genuine failure, which now sets a real, visible error message ("Something went wrong on my end. Try again?") in the stuck bubble. `finally { setStreaming(false); }` guarantees the streaming lock always releases regardless of outcome, so the Stop/Send button never gets stuck either.

`IMPLEMENTED`, `TYPECHECKED`. `BROWSER_VERIFIED`: partial — confirmed the abort path logic is correct by code review (matches `ThriveAgentFab`'s proven behavior exactly) and confirmed no regression to the normal happy-path console output. Actually forcing a network failure mid-stream to observe the recovered error bubble live requires a real account; `NOT_CONFIRMED` for that specific scenario.

## Also fixed

- `src/pages/KretoTab.tsx` — corrected a stale doc comment claiming the page "Auto-opens the real Copilot (Sheet…) on arrival," which doesn't happen; the page renders `InlineKretoChat` inline, not the global Sheet. `IMPLEMENTED`.

## Explicitly not done in this pass

- Multi-conversation session support (new/rename/search/archive/delete, per the audit's §C finding that today's backend hardcodes one thread per user) — this is a separate, larger P0 item in the brief's own ordering (item 3, after functional fixes), needs a product decision on migration shape for existing single-thread users, and was not part of "the P0 fixes" this round approved.
- Full action/plan execution parity with `ThriveAgentFab` on `/kreto` (see Fix 1) — deliberately scoped out as a larger feature, not a bug fix.
- Latency measurement/optimization (audit §B) — no live timing data was available to act on; `NOT_AVAILABLE` without a real session to profile.

## Regression check

- `npm run typecheck` → PASS
- `npm run build` → PASS
- No new console errors observed on `/kreto` (anonymous session) beyond the same generic auth-gated-call 400/401/403/404s seen on every other page this session for logged-out visitors.
