# "Tell Kreto what you need" is free: routing without AI credits

Status: **code complete in this PR; not merged, not published, not pasted.** No SQL, no policy, no secret, no data change, no new provider.

## 1. The error

`POST /functions/v1/route-studio-outcome` answered **402 Payment Required** when a user typed in "Tell Kreto what you need" in a Studio.

**What the 402 was.** Not a Kretopia premium gate: `route-studio-outcome` has no tier check at all. It sent every request to the AI gateway (`ai.gateway.lovable.dev`) to pick one of five outcomes, and passed the gateway's own 402 ("Workspace AI credits exhausted") back to the browser. The Lovable workspace's AI credits are exhausted (they have been frozen by decision), so every request failed, including the seven quick-start chips.

## 2. The change

The decision is "which of five outcomes", and the product already spells its rules out in the router's own system prompt. It is now made by those rules, with no network call and no credit:

| Layer | Behaviour now |
|---|---|
| `_shared/studioOutcomeRouter.ts` (new, pure) | `routeByRules`: letter of intent, invoice or quote, document (nine intents), find people, find gigs, otherwise chat. English and French, accents folded. Returns `confident = false` for an unplaced request |
| `StudioOutcomeComposer.tsx` | the rules run first, in the browser. A recognised request navigates immediately: **no function call, no credit, no latency**. Only an unplaced request asks the function; if the function is unavailable or errors (any status, including the old 402), the rule result (chat) stands. The "Kreto couldn't route that" toast no longer appears for payment or quota errors |
| `route-studio-outcome/index.ts` | the same rules first; the AI only for an unplaced request, with an 8 s timeout; any failure (no key, 402, 429, 5xx, timeout, no tool call) returns the rule result with HTTP 200. It never answers 402 or 429 for the gateway |

Because the composer decides locally, **the user's error is fixed by a frontend publish alone**; the function paste is not required for it (the old function is only called for an unplaced request, and a 402 there is swallowed).

## 3. Tests

- `studioOutcomeRouter.test.ts`: 19 passing. The seven quick-start prompts exactly as the composer sends them, each placed without AI; the five outcomes; French; an invoice word that does not hide a proposal; filler stripping; and wiring that the function has no `402` or `429` path and that rules precede the gateway.
- `StudioOutcomeComposer.test.tsx`: 7 passing. A quick-start chip navigates with **no function call and no toast**; the Letter of Intent and crew chips route correctly; an unplaced request whose router answers 402 opens the copilot and shows **no error**; the router's own answer is still used when it is available.
- ESLint clean on the touched files. Not run: a live Studio session (needs an authenticated account and a project).

## 4. What "free" can and cannot mean here (read this)

- **Routing is now free.** Choosing the outcome costs nothing.
- **The step after it is not.** A document is written by `thrive-document-engine`, which calls the AI gateway; it has no Kretopia premium gate either, but it needs AI credits and answers 402 ("Workspace AI credits exhausted.") when the workspace has none. 49 edge functions pass that same gateway 402 through. No code change can make a model call free: the cost is the provider's. Until the workspace has credits again, document generation, copilot chat and the other AI features will fail with that message, and only the AI credit balance (or an owner-approved provider change) fixes it.
- **Kretopia's own tier caps are separate and still on.** Read from the repository: 22 edge functions read `profiles.subscription_tier`; the free-tier caps found are `desk-ai` (10 messages a day), `desk-agent` (20 actions a day), `thrive-ai-chat` (a daily Copilot limit), `scout-gigs` (1 preview a week for free), and the Studio AI generators through `studioAIGate`; 65 client files reference tier gating. Making every feature free until the Premium kick-off is a switch over those gates, not a change to this endpoint: proposed as the next slice below, not done here.

## 5. Next slice proposed: one Premium switch

A single constant, `PREMIUM_ENFORCED = false`, read by one server helper and one client helper that return the effective tier; every tier comparison in the 22 functions and the client gates goes through them, so the Premium kick-off is one value, not 65 edits. It does not touch abuse limits (rate limits, token ceilings, cooldowns), which are not tiers. It is a product-wide behaviour change and a many-function manual paste, so it is a slice of its own.

## 6. Release and rollback

| Item | State |
|---|---|
| frontend (composer, router import) | takes effect on the next frontend publish; this alone removes the user's error |
| `route-studio-outcome` + `_shared/studioOutcomeRouter.ts` | manual paste into `kretopia-app`, helper first; not required for the fix, makes the function itself consistent |
| rollback | revert the commit (frontend); re-paste the previous function |

Checksums: `studioOutcomeRouter.ts` `e216b5b101422b472d5616b5a340484847c91c72ad0537cfd4d8c7baa88775e2`, `route-studio-outcome` `acbae65675b3c67802e47e74540d2a2133cda27a1e44def6c339baef65075e98`.
