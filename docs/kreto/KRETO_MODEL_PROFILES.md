# Kreto model profiles and effort levels

Status: Phase 1 design, 2026-11-15. Nothing here is implemented yet. Companion to `KRETO_OVERHAUL_PLAN.md` §3, §4 and §9.

Kreto profiles are **Kretopia-branded routes**, not separate proprietary models. Each profile is a server-side bundle of: one configured model tier, a prompt focus, a context scope, a tool allow-list and per-request caps. Several profiles share a tier and differ by focus and caps. User-facing copy never names a provider or a model id.

---

## 1. Server-side model tiers

The provider mapping lives only on the server, in `supabase/functions/_shared/aiModels.ts` (the existing single source of model ids) and a new pure module `_shared/kretoProfiles.ts` that maps profiles to these tiers. Neither is ever sent to the browser.

| Tier | Constant in `aiModels.ts` today | Role |
|---|---|---|
| T0 Lite | `GEMINI_FLASH_LITE` | routing, classification, autocomplete, thread summaries |
| T1 Fast | `GEMINI_3_FLASH` | everyday replies, desk agent, watchers, triage |
| T2 Strong | `GEMINI_3_8_FLASH` | long or document requests, planning, structured outputs |
| T3 Pro | `GEMINI_3_1_PRO` | research synthesis, long context, high-stakes reasoning |

Swapping a provider model is a one-line change in `aiModels.ts` (its own retirement note applies). The Cloud `ai_credit_config.model` column can override a tier per feature without a code change.

## 2. The ten profiles

| Profile | Intended use | Tier (explicit choice) | Default effort | Context scope | Tools allowed | Available |
|---|---|---|---|---|---|---|
| **Kreto Signal** | Fast answers, routing, classification, one-line drafts | T0, T1 at Balanced+ | Quick | identity + selected section counts | ask_clarification, read tools | all plans |
| **Kreto Pulse** | Everyday production help: tasks, drafts, summaries | T1 | Balanced | USER FACTS (selected sections) | all `safe_auto` read/draft tools; approvals as cards | all plans |
| **Kreto Vision** | Deep planning, strategy, multi-step work | T2, T3 at Maximum | Deep | selected sections + selected project's Brain | planner (`<plan>`), all tools via approval | paid plans (decision) |
| **Kreto Oracle** | Research synthesis, long context, high-stakes decisions | T3 | Maximum | everything selected, long history summary | research (consent), read tools | paid plans, opt-in |
| **Kreto Forge** | Structured outputs: decks, rate cards, treatments, JSON layouts (open decision: keep or drop) | T2 | Deep | selected project + documents | document engine tools | paid plans |
| **Kreto Echo** | Voice: short, conversational, spoken-friendly | T1 | Quick | identity + current surface | read tools; actions as cards on screen | all plans (voice caps apply) |
| **Kreto Atlas** | External research and source gathering | T1 (+ research providers) | Balanced | identity + the brief | `research_web`, `find_sponsors`, `analyze_profile_url` (consent) | all plans, consent required |
| **Kreto Ledger** | Invoices, quotes, money summaries, reconciliation support | T2 | Deep | Money only (owner or money-visible roles) | money drafts; sending always approval; `charge_card` locked | all plans |
| **Kreto Studio** | One project: briefs, tasks, deliverables, recaps | T1, T2 at Deep+ | Balanced | the selected project's facts, tasks, Brain | desk tools (approval rules unchanged) | all plans |
| **Kreto Scout** | Opportunity discovery and application prep | T1 | Balanced | Passport + Scout results | `search_scouted_gigs` (consent), `draft_gig_application`, `summarize_opportunities` | all plans |

**Auto** (the default) picks a profile from the request (§5) and never chooses a tier above the effort ceiling (§3).

## 3. Effort levels

Effort sets the caps on the server. The user sees the label and the estimate, never the numbers below.

| Level | Label | Highest tier for Auto | Output cap (tokens) | History | Context | Tool calls | Planner turns | Web sources | Confirm |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Quick** | T1 (T0 for Signal) | 300 | summary + last 4 turns | identity + chosen sections, compact | 1 | 1 | 0 | never |
| 2 | **Balanced** | T1 | 600 | summary + last 8 | chosen sections | 2 | 2 | ≤ 5 (if web on) | over threshold |
| 3 | **Deep** | T2 | 1,200 | summary + last 12 | chosen sections + project Brain | 4 | 3 | ≤ 10 | over threshold |
| 4 | **Maximum** | T3 | 2,000 | summary + last 20 | everything chosen | 6 | 3 | ≤ 20 | always shows the estimate; confirms over threshold |

The existing orchestrator ceiling (`MAX_TURNS = 3`) stays the hard limit for planner turns at every level.

## 4. Token and cost assumptions

No price is hard-coded. Every estimate is computed at request time from the cached workspace catalog (`ai_model_pricing`, refreshed daily) for the mapped tier:

```
estimate_credits = (system_tokens + context_tokens + history_tokens + input_tokens) × input_rate(tier)
                 + output_cap(effort) × output_rate(tier)
                 + research_sources × research_cost_per_source      (Atlas, Oracle, Scout with web on)
```

Token counts use the same estimator as today's `kreto_tokens` gate. The settled cost is always the provider receipt (`ai_model_calls.credits`); the estimate only decides whether to ask first.

Known measured anchors (from the repository's seed data, to re-measure in shadow mode):
- `kreto_message` is estimated at 0.006 credits per message on today's route mix with ≤ 800 output tokens.
- The global daily envelope is 0.167 credits, the measured peak daily spend on 2026-10-27.

Assumptions to confirm in shadow mode (Phase 2, step 2): the relative cost of T1/T2/T3 per 1,000 tokens from the catalog; the share of turns that hit each effort; research cost per source; the average history saving from summaries (expected to be the largest single saving, since today every request carries up to 40 raw turns).

## 5. Routing rules (Auto)

Evaluated in order by `resolveKretoRoute()`; the first match wins, then the effort ceiling applies.

1. Voice turn → **Echo**.
2. Request is a navigation or a known instant route (`kretoInstantRoute`) → no model call.
3. Short classification, a yes/no, or a one-line edit → **Signal**.
4. Money words with an invoice, quote, payment link or receipt in context → **Ledger**.
5. A selected project, or the request names one in USER FACTS → **Studio**.
6. Gigs, castings, applications, "find work" → **Scout**.
7. "Research", "find venues/brands/sponsors", external facts → **Atlas** (asks for web consent if not granted).
8. Deck, proposal, treatment, rate card, one-pager, structured layout → **Forge** (or **Vision** if Forge is dropped).
9. Three or more chained steps, strategy, "plan my…" → **Vision** if the effort allows T2, else **Pulse** with a suggestion to raise effort.
10. Everything else → **Pulse**.

**Explicit choice** always wins over these rules. It is refused only when the profile is not on the user's plan, needs consent the user has not given (web), or the request is unsafe. In every refusal case Kreto names the reason and the nearest allowed profile.

**Never silently upgrade**: if Auto's best match needs a higher tier than the effort allows, Kreto answers within the ceiling and adds one line: "A Deep pass would cover the full plan. Switch to Deep?" The switch happens only on the user's tap.

## 6. Fallback rules

| Situation | Behaviour |
|---|---|
| The mapped tier is busy or errors (429, 5xx, timeout) | Retry once on the same tier, then fall back **down** one tier with a visible note: "Kreto Vision is busy right now. I answered with Kreto Pulse." Never up. |
| Pricing for the tier is unavailable | Refuse before calling: "I can't price this request right now, so I won't run it. Try again in a few minutes." (existing `loadModelPricing` behaviour) |
| Provider receipt missing | The reply stands; settlement is retried; further gated calls block until reconciled (existing rule) |
| Research provider fails | Answer from Kretopia data only, labelled, with "Web research didn't respond. Nothing here comes from the web." |
| Weekly allowance would be exceeded | Hard stop with the reset time; offer Quick on Signal if it still fits |
| Profile unavailable on the plan | Refuse with the nearest allowed profile and one line about which plan includes it |
| Web consent missing | Ask once with the three choices (this time, always, never) |

## 7. Quota rules

| Rule | Source | Status |
|---|---|---|
| Daily message cap per tier | `consume_copilot_message`, `TIER_DAILY_CAPS` | exists (Premium not enforced: safety ceiling) |
| Daily message and token allowance | Cloud `try_reserve_ai_credit` (`kreto_message`, `kreto_tokens`) | exists |
| Global daily envelope | `ai_credit_envelope` (0.167 credits) | exists |
| Unsettled receipts block | `gateAiCall` | exists |
| **Weekly credit allowance per tier** | Cloud ledger, weekly window, micro-credit units | new (migration + config; amounts are a product decision) |
| **Per-request share threshold** | config, suggested 10% of the remaining week | new |
| **Hard stop when remaining < estimate** | gate | new |
| Expensive profiles opt-in | preferences | new |
| Voice seconds per day | `consume_voice_seconds` | exists (not enforced while Premium is off) |

The weekly window resets Monday 00:00 UTC (to confirm). The UI shows the reset time in the user's local time.

## 8. UI copy

Voice: first person, short, no emoji, never "AI", never a provider or model id.

**Selector heading**: "Kreto model". Help line: "Same Kreto, tuned for the job. Faster or deeper, your call."

| Profile | One-line description |
|---|---|
| Kreto Signal | Quick answers and one-line edits. |
| Kreto Pulse | Everyday production help: tasks, drafts, summaries. |
| Kreto Vision | Plans and strategy that take several steps. |
| Kreto Oracle | Long research and high-stakes decisions. Uses more of your allowance. |
| Kreto Forge | Decks, rate cards and structured documents. |
| Kreto Echo | Short spoken replies for voice. |
| Kreto Atlas | Looks outside Kretopia and shows every source. |
| Kreto Ledger | Invoices, quotes and money summaries. Nothing is sent without you. |
| Kreto Studio | Works inside one project. |
| Kreto Scout | Finds opportunities and prepares applications. |
| Auto | I pick the right one, never a more expensive one than your effort allows. |

**Effort heading**: "Effort".

| Level | Label | Description |
|---|---|---|
| 1 | Quick | Fast answer, lightest on your allowance. |
| 2 | Balanced | Normal production work. |
| 3 | Deep | Planning and analysis across steps. |
| 4 | Maximum | The most thorough pass. Uses the most allowance. |

**Estimate and guard lines**:
- Under the threshold: nothing extra; the quota line stays.
- Over the threshold: "This needs about 18% of what's left this week. Run it?" [Run] [Use Balanced]
- Over the remaining allowance: "This needs more than you have left this week. It comes back Monday at 01:00." [Use Quick]
- Fallback: "Kreto Vision is busy right now. I answered with Kreto Pulse."
- Plan limit: "Kreto Oracle is on Creator Pro. I can run this with Kreto Vision."
- Web consent: "This needs the web. Search this time, always, or never?"

**Quota line**: "12 of 30 messages left today · 64% of this week left · resets Monday".

**Response labels**: "From your Kretopia data" and "From the web (searched 15 Nov)". Sources list title, site and date.
