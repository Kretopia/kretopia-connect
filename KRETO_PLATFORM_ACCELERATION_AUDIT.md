# Kreto Platform Acceleration — Phase 1 Read-Only Audit

**Status of this document:** Phase 1 read-only audit. No code has been edited to produce this report. All findings are evidence-based with file:line citations gathered by parallel source-code exploration, plus a baseline `typecheck`/`lint`/`build`/`test` run. Nothing below has been verified in a running authenticated browser session — this environment has no test-account session available, same limitation noted throughout this project's prior audits.

**Tag legend:** `SOURCE_CONFIRMED` · `RUNTIME_CONFIRMED` · `NOT_CONFIRMED` · `NOT_AVAILABLE`.

**Baseline:**
- `npm run typecheck` → **PASS**, `SOURCE_CONFIRMED`
- `npm run build` → **PASS**, `SOURCE_CONFIRMED`
- `npm run lint` → **FAIL** — 13,922 pre-existing problems (12,702 errors / 1,220 warnings), same magnitude and same unrelated files (`tailwind.config.ts`, edge functions with `any`) as every prior baseline run this project. Pre-existing drift, not in scope.
- `npm run test` → 121/127 pass; the same 6 pre-existing `stripeWebhookSignature.test.ts` failures (unrelated `crypto.subtle`-in-Vitest gap) seen in every prior run. No new failures.

---

## A. Kreto Functional Status

Two independent, loosely-coupled backend functions exist — `thrive-ai-chat` (chat + streaming + persistence) and `agent-orchestrator` (intent classification + tool execution) — connected only by a client-side contract: the model is instructed to emit `<action>`/`<plan>` tags in its text, which a capable frontend surface is expected to parse and act on. `SOURCE_CONFIRMED`.

**Two frontend surfaces exist for Kreto, and they are not equivalent:**

1. **`ThriveAgentFab`** (the global floating Copilot, opened from the bottom nav / `ThriveBar` / `KretoTip`) — correctly parses `<action>`/`<plan>` tags via `extractActions`, and calls `loadCopilotHistory()` on open. `SOURCE_CONFIRMED`.
2. **`InlineKretoChat`** (rendered on the dedicated `/kreto` page, `KretoTab.tsx:116`) — does **not** import or use `extractActions`/`AgentApprovalCard` at all, and does **not** call `loadCopilotHistory()`. `SOURCE_CONFIRMED` via grep (zero call sites in either case).

**Root cause candidate #1 (highest confidence): raw action/plan tags leak into the visible chat on `/kreto`.** The shared backend's system prompt instructs the model to emit these tags for *all* surfaces including `"home"` — the surface identifier `InlineKretoChat` actually sends (`InlineKretoChat.tsx:45`) — and the backend passes chunks through unchanged specifically so "the FAB's `extractActions` picks it up" (`thrive-ai-chat/index.ts:683-684`, comment). Since `InlineKretoChat` has no such parser, any time the model proposes an action, the literal `<action>{...}</action>` / `<plan>{...}</plan>` markup renders verbatim in the chat bubble. This is a strong, precisely-evidenced candidate for "Kreto is not 100% functional" — it would look broken/glitchy on the one page literally named "Kreto." `SOURCE_CONFIRMED`.

**Root cause candidate #2: no conversation persistence/rehydration on `/kreto`.** The backend writes every turn to `ai_conversations`/`ai_messages` (confirmed schema and write sites below in §C), and a `loadCopilotHistory()` helper already exists and is already used by `ThriveAgentFab`. `InlineKretoChat` never calls it — `messages` state initializes to `[]` with no rehydration effect (`InlineKretoChat.tsx:12`). Result: refreshing `/kreto` loses the visible conversation even though the database row survives. `SOURCE_CONFIRMED`.

**Root cause candidate #3: unguarded async paths can leave a permanently-stuck "thinking" spinner.** `thriveCopilot.ts:58` (`getSession()`) and the SSE reader loop (`thriveCopilot.ts:117-143`) are not wrapped in try/catch; a thrown rejection reaches only `InlineKretoChat.tsx:58`'s `.catch(e => console.error(...))`, which never updates `messages` state. The loading bubble is keyed on `!m.content` (`InlineKretoChat.tsx:87-91`), so an empty bubble persists indefinitely with no visible error and no timeout. `SOURCE_CONFIRMED`.

**Stale doc comment:** `KretoTab.tsx:59` claims the page "Auto-opens the real Copilot (Sheet…) on arrival" — no such dispatch exists in the file. `SOURCE_CONFIRMED` as inaccurate; low-severity but worth correcting so the comment matches runtime behavior.

**What already works correctly** (do not re-architect): JWT-based auth resolution in both edge functions (`thrive-ai-chat/index.ts:124-133`, `agent-orchestrator/index.ts:611-617`); real SSE streaming with a working `AbortController`-based Stop button (`InlineKretoChat.tsx:15,32-33,69-72`); daily-cap rate limiting on both functions; clean JSON error responses (no raw stack traces) for known failure branches; intent-based tool selection in `agent-orchestrator` (12 fixed `agent_kind`s, `index.ts:60-73`).

## B. Kreto Latency Breakdown

`NOT_CONFIRMED` for actual millisecond timings — no live authenticated session was available to measure real request timing in this environment (no test account). What's `SOURCE_CONFIRMED` from code alone:

- Model routing: `google/gemini-3.1-pro-preview` for main chat (`thrive-ai-chat/index.ts:561`), `gemini-2.5-flash-lite`/`gemini-3-flash-preview` for orchestrator classification/planning. A code comment (`index.ts:558-560`) documents that flash-tier models are known to drop `<action>`/`<plan>` tags under load — mitigated by a regex "guardrail" that synthesizes a `<plan>` tag when the assistant's prose "sounds like a broken promise" (`index.ts:654-691`). This is a heuristic patch over a real model-compliance gap, not a latency issue per se, but a plausible source of *wrong* (not just slow) behavior.
- `agent-orchestrator` has explicit timeout budgets: 45s per planner call, 20s for classification, 110s overall soft budget to stay under the presumed edge-function limit (`index.ts:35-43, 215-222`). `thrive-ai-chat` has no equivalent documented timeout budget for the main streaming call — `NOT_CONFIRMED` whether one exists implicitly via the platform's own function timeout.
- No caching layer for conversation/profile context was found in either function (each request re-derives context fresh) — `SOURCE_CONFIRMED` absence, but the actual cost of this in wall-clock time is `NOT_CONFIRMED` without live measurement.
- `agent-orchestrator` reads `LOVABLE_API_KEY` at module load rather than per-request (`index.ts:30`) — functionally fine, but means a missing key fails only when `classifyIntent`/`planTools` are reached, after the tool registry fetch and an `orch_runs` insert already happened (`index.ts:58,141`) — wasted work on a config error, not a normal-path latency issue.

## C. Kreto Conversation Persistence Status

**Persistence exists and is live in production, contrary to a "nothing persists" assumption.** `SOURCE_CONFIRMED`.

Schema (`supabase/migrations/20260211172225_0a783d8f-c168-4073-83ef-a1ea9b96348f.sql:3-52`):
```
ai_conversations: id uuid PK, user_id uuid, title text default 'New Chat', created_at, updated_at
ai_messages: id uuid PK, conversation_id uuid FK→ai_conversations, role text CHECK IN ('user','assistant'), content text, created_at
```

Write sites: user turn (`thrive-ai-chat/index.ts:494-498`), assistant turn in the stream `flush()` (`index.ts:695-699`) and the non-stream path (`index.ts:594-598`). Read site: history loaded at `index.ts:356-362`. The frontend service `thriveCopilot.ts:77-78` confirms `persist: true` is actually sent in production for the surfaces that use it.

**The critical limitation: this is a single-thread-per-user model today, not a multi-conversation model.** `getOrCreateCopilotThread` (`copilotContext.ts:540-559`) hardcodes fetching or creating exactly one row per user keyed on `title = '__copilot__'`. The `ai_conversations` table's schema *could* support multiple named conversations per user (it has its own `id`, `user_id`, and a real `title` column) — but no code path today creates a second one, lists a user's conversations, or lets them switch between threads. Building "conversation sessions: new/rename/search/archive/delete/return to a prior one" (per this brief's P0 §4) is a **new feature on top of an existing single-thread table**, not a bug fix to existing multi-thread logic. `SOURCE_CONFIRMED`.

**Persistence failures are silent.** Every DB write is wrapped in try/catch that only `console.warn`s on failure (e.g. `index.ts:504-506, 725-727`) — a transient DB error drops a message with no error surfaced to the client or user. `SOURCE_CONFIRMED`.

**`InlineKretoChat` doesn't participate in persistence at all on read** (see §A candidate #2) — it's unclear from code alone whether it sends `persist: true` on write; `NOT_CONFIRMED`, worth checking directly before implementation.

## D. Kreto Tool/Approval Integrity

- `agent-orchestrator` loads enabled tools from `orch_tool_registry` (`index.ts:1112-1115`), classifies intent into one of 12 kinds, and exposes intent-scoped tools plus a fixed always-available baseline (`ask_clarification, find_user, list_my_projects, add_collaborator, remove_collaborator, archive_project, delete_project, research_web, find_sponsors`, `index.ts:147-157`) as OpenAI-style function-calling tools. `SOURCE_CONFIRMED`.
- Malformed tool-call JSON from the model is caught and defaults to `{}` rather than crashing (`index.ts:258`); unknown tool names are handled gracefully (`index.ts:263-266`). `SOURCE_CONFIRMED` — this part is robust.
- **`InlineKretoChat` has no approval-card UI at all** (§A) — any action the model proposes on `/kreto` either leaks as raw tag text (if using `thrive-ai-chat`'s prompt) or is invisible (no rendering path exists for a structured proposal). This is the same root cause as §A candidate #1, restated from the approval-integrity angle: **the approval boundary the rest of the brief assumes ("no action completed before approval") is enforced correctly in `ThriveAgentFab` but doesn't exist as a UI surface at all in `InlineKretoChat`.**
- Trusted internal bypass: both `thrive-ai-chat` and `agent-orchestrator` accept a client-supplied user ID via `x-internal-user-id` header *when paired with* `Authorization: Bearer <SERVICE_ROLE_KEY>` (`thrive-ai-chat/index.ts:109,116-123`; `agent-orchestrator/index.ts:603-610`). This is safe as designed (a normal client can never possess the service-role key), intended for trusted server-to-server callers (e.g. a Telegram webhook) — flagged for awareness, not as a vulnerability, since exploiting it requires already having the service-role key, at which point far worse access already exists.

## E. Landing Content and CTA Map

(Synthesized from this project's own prior deep audit of `KretopiaLanding.tsx`/`LandingBelowFold.tsx`/`KretopiaHero.tsx`, confirmed unchanged since that audit — no landing files have been modified since. Re-verify before implementation if significant time has passed.)

- Route `/` → `DefaultRoute` → `UnifiedHome` → (guest) `KretopiaLanding`. 13 stacked sections: Hero → SearchTutorialSection → InlineSignupBar → 4× ChapterSection (Passport/Scout/Match/Studio) → VerifiedCreditsChapterSection → TrustSection → ProductLoopSection → MeetKretoSection → CreativeUniverseSection → ChapterSection(Community) → ForOrganisationsSection → ClosingCTASection → EditorialFooter. `SOURCE_CONFIRMED`.
- This structure is a **deliberate, already-shipped replacement** for an older landing page — `UnifiedHome.tsx:546-548` documents the retirement directly. Established finding from this project's prior audit, still holds. `SOURCE_CONFIRMED`.
- Primary CTA ("Claim your Passport") is in the Hero, above the fold, routes to `/auth?tab=signup&intent=hero` (`KretopiaHero.tsx:259`). Secondary "Sign in" CTA also present (`:267`). Primary interaction is the search bar itself, not a button — a prior CTA row was deliberately removed per an in-code comment (`KretopiaHero.tsx:213-216`). `SOURCE_CONFIRMED`.
- `FAQSection.tsx` exists but is dead code (imported, never rendered) and carries stale pre-rebrand branding ("ThriveDesk" vs. current "Studio" per `brandLexicon.ts:109`) — established finding, still holds. `SOURCE_CONFIRMED`.
- `useLandingVariant` (named in this new brief) — **`NOT_CONFIRMED`**: no prior audit checked for this specifically; needs a direct grep before assuming an A/B-test variant system exists.
- Pricing section — **`NOT_CONFIRMED`** whether one exists on the current landing page; not covered in the prior audit's section list, needs direct verification.

## F. Landing Conversion Instrumentation Status

- Extensive existing tracking, already wired: `trackLandingCta`/`trackLandingSectionViewed` (`src/lib/landingFunnel.ts`), `trackLandingCtaClick` (`src/lib/landingMetrics.ts`), used across `ChapterSection.tsx`, `ProductLoopSection.tsx`, `ClosingCTASection.tsx`, `InlineSignupBar.tsx`, `StickyMobileCTA.tsx`, `ForOrganisationsSection.tsx`, `MeetKretoSection.tsx`. `LandingFunnelTracker.tsx` generically observes every `section[id]`. `SOURCE_CONFIRMED` (prior audit).
- Auth redirect (`?next=`) correctly preserved end-to-end (`Auth.tsx:72-73`, `eventAuthRedirect.ts:24-35`) — a past bug where this was silently dropped was already fixed per an in-code comment. `SOURCE_CONFIRMED` (prior audit).
- Any change to Landing under this new brief must preserve every one of these tracking call sites, not just the visual sections they're attached to.

## G. SEO Inventory

- Shared `src/components/SEO.tsx` (via `react-helmet-async`) used in 64 files; sets title/description/robots/OG/Twitter tags, conditional canonical `<link>`, conditional `Person` JSON-LD. `SOURCE_CONFIRMED`.
- `index.html` has `Organization`/`SoftwareApplication`/`WebSite` JSON-LD, full OG/Twitter meta, no static canonical (set per-route instead). `SOURCE_CONFIRMED`.
- `EventPage.tsx` has real `Event` JSON-LD (`:336-366`). `CreatorEPK.tsx` (`/epk/:id`) has full `Person` JSON-LD + canonical + OG image. `SOURCE_CONFIRMED`.
- **Gaps found:** `ViewProfile.tsx` and `CreatorSite.tsx`/`CreatorSiteByUsername.tsx` set title/description only — no `Person` JSON-LD, no canonical, no OG image override. `SOURCE_CONFIRMED`.
- `public/sitemap.xml` is a **static, hand-maintained file** — 24 URLs including 15 hardcoded `/epk/{uuid}` profile links — not dynamically generated, so it silently goes stale as new profiles/events are created. `SOURCE_CONFIRMED`.
- `robots.txt` allows everything (no `Disallow` lines at all) and lists `/auth` in the sitemap despite it being an auth page. `/dashboard` (protected, redirects to `/desk`) is also not noindexed or sitemap-excluded. `SOURCE_CONFIRMED`.
- Several route "redirects" (`/circle/:id → /crew`, `/events → /meetup`, `/circles → /crews`, `/meetups → /meetup`, `/agent → /circle`, `/thrive-ai → /circle`) are **client-side `<Navigate>` components**, not HTTP 3xx — a non-JS-executing crawler won't follow them. `SOURCE_CONFIRMED`.
- App is a **pure client-side SPA** — `index.html`'s body is just a root div + module script. Opt-in static-HTML-generator Vite plugins exist for social/profile/event/gig/magazine/campaign pages but are **disabled by default**, gated behind `VITE_GENERATE_STATIC_SOCIAL_PAGES=true` for "dedicated SEO export builds." In a normal production build, a crawler that doesn't execute JS sees only the static shell + `index.html`'s baked-in meta/JSON-LD. `SOURCE_CONFIRMED`.
- `llms.txt` present and populated (`public/llms.txt`). `SOURCE_CONFIRMED`.
- Alt text is inconsistent: `GigCard.tsx`/`OpportunityDetail.tsx` have meaningful `alt`; `ViewProfile.tsx`'s avatar and `UnifiedHome.tsx`'s hero visuals (CSS `background-image`) have none/are invisible to image-based indexing. `SOURCE_CONFIRMED`.

## H. Events Recommendation Data Map

No "people you may know" or mutual-connection UI exists today anywhere in Events — `EventPage.tsx`, `SessionParticipants.tsx`, and `EventGuestRoster.tsx` all show only a literal attendee roster with direct (not mutual) connect-state per person. `SOURCE_CONFIRMED` (`NOT_AVAILABLE` as a feature).

**The building blocks already exist, mostly unused:**
- `get_mutual_connections(user1_id, user2_id)` — a working, `SECURITY DEFINER` RPC already in the database (`supabase/migrations/20251004032858_...sql:33-71`) that correctly returns mutual accepted connections between two users. **Zero call sites anywhere in `src/`.** This is the exact primitive a "you both know X" feature needs, and it already exists — dormant, not missing. `SOURCE_CONFIRMED`.
- `connections` table RLS only allows a user to see rows where they are `user_id` or `connected_user_id` (`20250930073034_...sql:89-91`) — a client-side attempt to compute mutuals by querying *other* users' connection rows will not work; it can only ever see the current user's own side. **`src/components/circle/CreatorBrowseGrid.tsx:344-367` already attempts exactly this and is silently non-functional as a mutuals check under this RLS** — a real, if minor, existing bug worth flagging even though it predates this brief. `SOURCE_CONFIRMED`.
- `project_collaborators` and `credit_endorsements` tables give queryable "shared project" and "co-sign" relationships per user. `SOURCE_CONFIRMED`.
- `get_nearby_jams`/`get_nearby_creators` RPCs already exist as a directly reusable pattern for a future "nearby people" angle (lat/lng exist on `profiles` and `opportunities`). `SOURCE_CONFIRMED`.
- "Crew" maps to `spark_rooms`/`spark_room_members` with an `is_crew_member()` helper already defined. `SOURCE_CONFIRMED`.
- `user_blocks`/`user_reports` tables exist with an existing `useUserBlocks` hook — any future suggestion logic must exclude both directions. `SOURCE_CONFIRMED`.

**Implication for implementation (when this phase is reached):** the correct approach is a small `SECURITY DEFINER` RPC per suggestion type (mirroring `get_mutual_connections`, already proven safe under RLS), not a client-side join across other users' rows — the codebase already has one precedent bug (`CreatorBrowseGrid.tsx`) from trying the latter.

## I. Scout Ranking/Data Freshness Map

Two independent AI/keyword-based ranking systems exist today, **neither using any social-graph signal**:
- `scout-gigs` edge function → `ScoutedGigsSection.tsx`'s `fit_score`/`fit_reason`, computed from `profile.role, sub_roles, professional_skills, passion_skills, location` plus Scout preferences. `SOURCE_CONFIRMED`.
- `discover-creators` edge function → `BrowseCreators.tsx`'s `match_score`/`match_reason`, computed from role/location/credits keyword overlap. `SOURCE_CONFIRMED`.
- `src/lib/opportunityMatch.ts` (`computeOpportunityMatch`, used by `OpportunitiesFeed.tsx`) — pure client-side heuristic over skills/role/location overlap only. `SOURCE_CONFIRMED`.

Freshness/caching: `NOT_CONFIRMED` in this pass — none of the agents were asked to trace the exact cache/cron cadence of `scout-gigs`'s underlying data source; needs a direct check before implementing a "freshness timestamp" UI requirement from §10 of the new brief.

Same building blocks as §H (skills columns, location precision, `project_collaborators`/`credit_endorsements`) are available to add a "people in your network" module to Scout, with the same RLS caveat: must go through a definer function, not a naive client join.

## J. Global Performance Bottlenecks

- **No code-splitting config** (`vite.config.ts` has no `manualChunks`) but **all 128 routes are already `lazy()`-loaded** via a `lazyWithRetry` wrapper — route-level splitting is in good shape. `SOURCE_CONFIRMED`.
- Heavy libraries (`recharts`, `jspdf`, `html2canvas`, `pdfjs-dist`) are correctly feature-scoped, not imported in `App.tsx`. However, the actual built output shows a **2.38MB main entry chunk** and a **1.65MB `Discover` route chunk** — both large enough to warrant investigation (which modules are pulling into the main chunk specifically wasn't traced further in this pass). `SOURCE_CONFIRMED` (sizes), `NOT_CONFIRMED` (exact cause).
- **Image handling is inconsistent.** A shared `ImageLoader` wrapper exists (sets `loading="lazy"` + skeleton/fallback) but is used in only 2 files app-wide out of ~280 `<img>` tags; only 56 files use `loading="lazy"` at all; spot-checked components (event cover, gig card, avatar) have no explicit `width`/`height`, a real CLS risk. `SOURCE_CONFIRMED`.
- React Query has sensible, centrally-configured defaults (5min stale, 10min gc, no refetch-on-focus, retry:1) — not ad hoc. `SOURCE_CONFIRMED`.
- 77 realtime `.channel()` subscriptions across 60+ files; a 5-file spot check found correct `removeChannel` cleanup in every case — no confirmed leak, but not exhaustively reviewed. `SOURCE_CONFIRMED` (sample), `NOT_CONFIRMED` (full coverage).
- One confirmed N+1 pattern: `event-reminders/index.ts:136-147` loops per-participant instead of batching — already known from the prior Events audit, still present (out of scope of that prior fix, which only added the auth guard). Frontend spot-checks found no NEW N+1 patterns. `SOURCE_CONFIRMED`.
- No bundle-analyzer plugin configured — investigating the 2.38MB main chunk further would require adding one or manually tracing imports. `NOT_AVAILABLE` today.

## K. UX/UI High-Impact Issues

- The `/kreto` page (§A) is the highest-impact UX issue on the platform right now — it can literally render broken-looking raw tag markup and get permanently stuck with no visible error.
- Image CLS risk (§J) from missing width/height across most user-generated-content images.
- Everything else audited platform-wide (Landing, the 13 P2-priority feature surfaces from the prior audit) was already found well-structured in this project's own prior sessions — no new broad UX debt surfaced by this pass beyond what's already documented in `DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md`.

## L. Security/Privacy Risks

- `x-internal-user-id` + service-role-key bypass in both Kreto edge functions (§D) — safe as designed, flagged for awareness only.
- Silent persistence-failure swallowing (§C) — a reliability/data-integrity issue more than a security one, but means a user could believe a message was saved when it wasn't, with no error trail.
- `CreatorBrowseGrid.tsx`'s non-functional mutuals attempt (§H) is not a security hole (RLS is correctly preventing cross-user data access) — it's a functional bug caused by RLS working as intended against code that didn't account for it.
- No new RLS/auth/payment issues found in this pass. All of this session's prior security fixes (events, opportunities, referrals, etc.) remain independently verified live as of the last regression pass.

## M. Files to Modify (if approved)

**P0 — Kreto functional fixes (highest priority, do first per the brief's own ordering):**
- `src/components/kreto/InlineKretoChat.tsx` — add `extractActions`/approval-card rendering (reuse `ThriveAgentFab`'s existing pattern rather than inventing a new one); add `loadCopilotHistory()` call on mount; wrap the SSE reader loop and `getSession()` call in try/catch with a visible error state.
- `src/pages/KretoTab.tsx` — correct or remove the stale auto-open comment.
- Possibly `src/lib/thriveCopilot.ts` if a shared fix is cleaner than duplicating `ThriveAgentFab`'s parsing logic in `InlineKretoChat`.

**P0 — Conversation sessions (second, per the brief's explicit ordering — after functional fixes):**
- Backend: a way to create/list/rename/archive/delete multiple `ai_conversations` rows per user (today's `getOrCreateCopilotThread` hardcodes one). Needs design before touching — this is new capability, not a bug fix.
- Frontend: a session list/sidebar component, wired into `/kreto` (and optionally `ThriveAgentFab`).

**P1/P2 — deferred until Kreto P0 is done, per the brief's explicit "do not begin Events or Scout while Kreto is broken" instruction.**

## N. Files to Protect

- Everything Stripe/KrePay/wallet-related — untouched by this program by explicit instruction.
- `supabase/functions/mcp/index.ts` — known pre-existing local drift, never staged/committed, per standing project convention.
- `agent-orchestrator`'s tool-routing and timeout logic — already robust, not implicated in the root-cause findings above; avoid touching unless a specific new finding requires it.
- The 13-section Landing narrative structure — confirmed deliberate in a prior audit; any P1 work here should condense/reorder with explicit section-by-section sign-off, not a unilateral cut (same lesson as before).

## O. Migration Requirements

- No migration is required for the P0 Kreto tag-parsing/persistence-rehydration fixes (§A candidates #1–#3) — these are frontend-only changes calling existing backend capability.
- Multi-conversation session support (§C) likely needs **no schema migration** (the table already supports it) but does need new/changed RPC or query logic server-side — `REQUIRES_PRODUCT_DECISION` on exact shape (e.g., should the existing single `'__copilot__'` thread become "conversation #1" for existing users, or should it be left alone and only new conversations use the new multi-thread path?).
- Events/Scout network-suggestion RPCs (§H/§I) would each need a new `SECURITY DEFINER` function (following the `get_mutual_connections` precedent) — no destructive schema change, purely additive.

## P. Test Plan (for Phase 2, once approved)

- Unit: a test asserting `InlineKretoChat` strips/renders `<action>`/`<plan>` tags rather than showing them raw (mirroring however `ThriveAgentFab`'s existing behavior is tested, if at all — check first).
- Manual: send a message on `/kreto` that's likely to trigger a tool proposal (e.g. "add a task to my project"), confirm no raw tag text appears and an approval card renders instead.
- Manual: send a message, refresh the page, confirm the conversation reappears.
- Manual: simulate a network failure mid-stream (throttle/offline), confirm a visible error and recovery path instead of a permanently-stuck spinner.

## Q. Browser Verification Plan (for Phase 2/3, once approved)

Same structural limitation as every prior phase this session: no test-account session is available in this environment. The checklist in §15 of the new brief (open Kreto, send message, confirm persistence, rename/search/archive a conversation, test tool proposal/approval, test cancellation, confirm no duplicate send, mobile history drawer) will need to be run by the user or a designated tester once implementation lands — flagging this now rather than after the fact.

---

**Phase 1 complete. No code has been edited.**
