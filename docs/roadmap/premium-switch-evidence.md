# Premium kick-off switch: every gated feature is free until Premium starts

Status: **code complete in this PR; not merged, not published, not pasted.** No SQL, no policy, no secret, no data change, no new provider. Stripe products, prices and checkout are untouched.

Owner instruction: *every functionality of Kretopia must be free until we decide to apply the Premium kick-off.*

## 1. The mechanism: one constant per side

| Side | File | Read by |
|---|---|---|
| Browser | `src/lib/premiumSwitch.ts` (`PREMIUM_ENFORCED = false`) | `subscriptionConfig.ts` (`hasProAccess`, `hasCreatorProAccess`), `subscriptionLimits.ts` (`getMonthlyCapForFeature`, `getTierLimits`) |
| Edge functions | `supabase/functions/_shared/premiumSwitch.ts` (`PREMIUM_ENFORCED = false`) | the six cap sites below |

The two copies are separate on purpose (a browser constant cannot be trusted by an edge function) and a test asserts they agree.

**At the Premium kick-off:** set both to `true`, publish the frontend, paste the seven server files of section 4. Nothing else changes: every tier comparison already goes through these helpers.

## 2. What is unlocked (client)

Every consumer of the four helpers, without editing each of them (38 `hasProAccess` call sites, the monthly feature caps, `useFeatureGate` and `useFeatureUsage`, the swipe, portfolio and advanced-profile limits, opportunity postings and the other `TierLimits` fields):

- `hasProAccess`, `hasCreatorProAccess`: true for every account.
- `getMonthlyCapForFeature`: `-1` (unlimited) for every feature.
- `getTierLimits`: the top tier's limits for every account, individual and company.
- Three files that read `TIER_LIMITS[tier]` directly (`PortfolioSection`, `CreditsFullRecord`, `Profile`) now go through `getTierLimits`, so they follow the switch.

## 3. What is unlocked (server): six sites

| Function | Was | Now (while not enforced) |
|---|---|---|
| `desk-ai` | 10 messages a day for free | 500 (a safety ceiling, not a tier); paid tiers unchanged |
| `desk-agent` | 20 agent actions a day | 500 |
| `thrive-ai-chat` (Copilot) | 30 messages a day for free | 500 (paid caps above 500 unchanged, unlimited stays unlimited) |
| `_shared/studioAIGate` (Studio image and copy generation, via `generate-studio-image` and `generate-studio-copy`) | 5 generations a day | 200 |
| `scout-gigs` | 1 Scout preview a week for free | no weekly preview limit |
| `thrive-voice-turn` (Kreto Talk) | a free account's daily voice seconds refuse the turn | the seconds are still counted by `consume_voice_seconds`, the cap does not refuse |

The ceilings (`ABUSE_CEILING_DAILY_MESSAGES = 500`, `ABUSE_CEILING_DAILY_GENERATIONS = 200`) are the same for everyone and are not tiers: they stop a loop or a script from spending the provider's credits without bound. They are not removed by this switch.

Messages that told a user to upgrade because of a safety ceiling now say "come back tomorrow".

## 4. Server files to paste (helper first)

| Order | File | SHA-256 |
|---|---|---|
| 1 | `_shared/premiumSwitch.ts` | `f4e372d193fb9cd5d18cb772e5f4cfdbdc10f88a7f3c22e29e503ba5caaa1375` |
| 2 | `_shared/studioAIGate.ts` | `9832c908fe44950ce60389ad22eca52008ae68430e8970f3c901c09984b07b65` |
| 3 | `desk-ai/index.ts` | `8de853b2ae491f4186ee50dd559b5f747eef599228cb4a54837c79eaca1550a0` |
| 4 | `desk-agent/index.ts` | `8c4758594174688fb9bb6be1ac1b155a9574380f00a4ba02480a7656ef8f852f` |
| 5 | `thrive-ai-chat/index.ts` | `65fa2f6ae3b10f9182bcac5aee6907b592534ff3545dc6357fb5c5804f065b4a` |
| 6 | `scout-gigs/index.ts` | `11f082ec689bc1f9f8bee363c090b3b8d5bdcd449c3656072f06640e2bf402c9` |
| 7 | `thrive-voice-turn/index.ts` | `c9ca00e0c98c05ade854bb5923ea54d4f35cde6012c14529924e44cadaf6969a` |

`generate-studio-image` and `generate-studio-copy` pick the change up through the shared gate; they need no paste for this switch.

## 5. What this does NOT make free (read this)

1. **AI provider credits.** A model call costs the provider, whatever the tier. While the Lovable workspace has no AI credits, every AI feature answers 402 "Workspace AI credits exhausted" (49 functions pass that through). "Tell Kreto what you need" no longer depends on credits (PR #169); document generation, copilot chat, voice and the other AI features still do. Only the credit balance, or an owner-approved provider change, fixes that.
2. **Database-level limits** (triggers and RPCs; changing them needs an approved migration and a policy impact report):
   - the free-tier portfolio item limit (`20260217111849`);
   - the storage quota (`20260502122249`, `20260506004514`);
   - the monthly opportunity posting cap (`20260912100000`);
   - the daily AI message and generation counters' own RPCs keep counting (the ceilings above sit on top of them).
3. **Fees.** The platform fee schedule by tier (`src/lib/platformFees.ts`, the marketplace fee in the payment functions) is revenue, not a gate. It is unchanged.
4. **Billing screens and Stripe.** Subscription pages, checkout, the portal and `check-subscription` are untouched. A free account that is treated as Pro-level is still shown as a free account on the billing page.
5. **Server tier reads not in the six sites.** 22 edge functions read `profiles.subscription_tier`; the rest are billing, payments and founder flows (`check-subscription`, `create-founder-checkout`, `purchase-*`, `checkout-event-tickets`, `join-paid-circle`, `create-sound-stage`, `apply-to-stage`, `activate-og-promotion`, `create-payment-link-checkout`) and were left alone on purpose: they are money paths, not feature gates, and the payment logic is out of scope for this slice.

## 6. Cost note

While the switch is off, free accounts can use AI features up to the ceilings. That spends provider credits at a rate the tier caps used to hold down. This is the intended trade for "free until Premium", and it is why the ceilings are kept.

## 7. Tests

`src/lib/__tests__/premiumSwitch.test.ts`: 14 passing: both constants are false and equal; `dailyCapFor` (lifts a free cap to the ceiling, never above a tier's own cap, unlimited stays unlimited, enforced returns the tier cap, finite ceiling); `effectiveIsPro`; with the switch off a free account has Pro and Creator Pro access, no monthly cap, the top tier's limits (individual and company), unlimited swipes and portfolio; with the switch on (module mocked) a free account is limited and a pro account is not; wiring of the seven server sites and that no safety ceiling reads like an upgrade prompt. `subscriptionLimits.test.ts` (25) pins the switch on, because it tests the tier rules themselves. ESLint clean on the new and library files (the files edited at one line keep their existing `no-explicit-any` findings). Not run: a live session on a free account.

## 8. Rollback

Set both constants back to `true` (the full revert), or revert the commit. The server files are pasted individually: re-paste the previous copy of any one.
