# Kretopia — Month-to-Date Funnel Audit
**Period:** 1–14 August 2026 (data through 02:53 UTC, 14 Aug) · **Source:** live production DB (`site_analytics`, `analytics_events`, `auth.users`, `profiles`, product tables) · **Excluded:** internal accounts `ef429714…` , `a5b77c7a…`, `2bb6936f…` (Noé) wherever a user is identifiable.

---

## A. EXECUTIVE SUMMARY

| Question | Answer |
|---|---|
| **REAL TRAFFIC** | **538 unique visitors**, 356 sessions, 2,536 pageviews on `kretopia.com`. After removing internal/team visitors (~8) and one-hit `/`-only visitors that look automated, **realistically ~490 external visitors, of which only ~45 showed any human depth (2+ pageviews)**. |
| **SIGNUPS** | **6 accounts created** in the whole period (5 confirmed, 1 unconfirmed email). None are team accounts. |
| **PASSPORTS** | 6 profiles created (auto-created at signup). **4 completed onboarding. 0 claimed a pre-existing/unclaimed Passport.** |
| **ACTIVATION** | **0 users** reached meaningful value. 0 credits added, 0 co-signs, 0 messages, 0 applications platform-wide in August. |
| **RETENTION** | **1 of 6** August signups returned on a later day (syarif.amudi, 2 active days). 5 of 6 were single-session. |
| **DEMAND** | 18 scouted-gig actions (17 opens by 3 users, 1 "applied"), 12 speed-session RSVPs, 9 connections, 1 project, 1 invoice. Essentially all from pre-August/internal users. |
| **BIGGEST LEAK** | **Landing → any second page: 486 of 538 visitors (90.3%) viewed exactly one page and left.** Median time on page 5.1s. |
| **BIGGEST POSITIVE SIGNAL** | Of the ~35 visitors who reached `/auth`, **17 became identified users** — i.e. once someone actually reaches the auth screen, roughly half convert. The auth screen is not the problem; getting people there is. |
| **MOST URGENT FIX** | Instrumentation + landing. We cannot see hero search, Passport preview or claim clicks at all (not tracked), and 90% bounce means the landing gives no reason to take a second step. |
| **READY TO SCALE?** | **🔴 RED** — do not push significant traffic yet. With a 1.1% visitor→signup rate, 0% activation, and no funnel instrumentation between landing and auth, paid/GTM traffic would burn budget into a blind funnel. |

---

## B. FUNNEL DASHBOARD (Aug 1–14)

| Step | Users | Conv. from prev | Drop-off | Data quality |
|---|---|---|---|---|
| Unique visitor | 538 | — | — | ✅ measured |
| Clicked a primary CTA | **not tracked** | — | — | ❌ no event |
| Searched their name (hero) | **not tracked** | — | — | ❌ no event |
| Search result displayed | **not tracked** | — | — | ❌ no event |
| Passport/profile preview viewed | 12 visitors hit `/profile*` | 2.2% | 97.8% | ⚠️ page-level only |
| Clicked Claim Passport | 1 `claim_started` event (1 user) | — | — | ⚠️ barely instrumented |
| Reached `/auth` | 35 | 6.5% of visitors | 93.5% | ✅ |
| Signup method selected | 1 `signup_attempt` + 54 `signin_attempt` | — | — | ⚠️ signup path under-tracked |
| Account created | 6 | 17% of `/auth` visitors | 83% | ✅ |
| Email confirmed | 5 of 6 | 83% | 17% | ✅ |
| Onboarding started | 7 users (incl. pre-Aug) | — | — | ✅ |
| Onboarding completed | 4 of 6 Aug signups | 67% | 33% | ✅ |
| Credit added | **0** | 0% | 100% | ✅ |
| Co-sign requested / received | **0 / 0** | 0% | 100% | ✅ |
| Scout visited | 6 visitors | — | — | ✅ |
| Opportunity interaction | 3 users opened, 1 applied | — | — | ✅ |
| Studio/Desk visited | 8 visitors | — | — | ✅ |
| Project created | 1 | — | — | ✅ |
| Payment | 1 invoice | — | — | ✅ |
| Passport shared / referral signup | **not tracked** | — | — | ❌ |

**End-to-end: 538 visitors → 6 accounts (1.12%) → 4 onboarded (0.74%) → 0 activated (0.00%).**

---

## C. ACQUISITION BREAKDOWN

| Source | Visitors | Reached /auth | Signups |
|---|---|---|---|
| Direct / no referrer | 479 | majority | 3 |
| lovable.dev | 20 | 0 | 0 |
| **thrivein.io** (old brand) | 13 | 3 | 2 |
| LinkedIn (android app + web) | 12 | 1 | 0 |
| Instagram (l.instagram.com) | 6 | 0 | 0 |
| kretopia.com internal (self-referrals) | ~8 | — | — |
| oauth.lovable.app (OAuth return hop) | 4 | 4 | 3 |
| Gmail app | 2 | 1 | 1 |
| Google search | 2 | 0 | 0 |
| Facebook / m.facebook | 2 | 0 | 0 |
| Perplexity.ai | 1 | 0 | 0 |
| localhost (dev) | 3 | — | — |

**Attribution data we do NOT capture:** UTM source/medium/campaign (never parsed or stored), ambassador/referral code on the visit row, first-touch vs last-touch, channel classification, campaign IDs. 89% of traffic lands as "direct" — meaning WhatsApp, most in-app browsers, and any untagged link are indistinguishable.

---

## D. GEOGRAPHY

**Not measurable.** `site_analytics.country` is **NULL for 100% of rows (538/538)** — the column exists but nothing populates it. The country list you were shown (Indonesia, Japan, US, Singapore, Switzerland, UAE, T&T, France, Barbados) does not come from this table; it comes from the hosting/CDN analytics layer, which counts raw HTTP hits including bots.

Circumstantial evidence on that traffic:
- 486 of 538 visitors made **exactly one** pageview, all on `/`, all with no referrer, 0 clicks, and most with no duration event → consistent with crawlers/preview-fetchers, not human sessions.
- 375 desktop vs 128 mobile visitors — inverted for a creator-audience product, another automation signal.
- The 6 real signups map to Indonesia (Bali), France ×3, Barbados/T&T ×1, Russia/unknown ×1 — which is consistent with genuine Future Caribbean + Noé's France network reach.

**Verdict: unclassified, but the single-page desktop no-referrer mass is more likely crawler/infrastructure than genuine audience.** To resolve this properly we need server-side IP→country + user-agent capture (see section O).

---

## E. DEVICE

| Device | Visitors | Pageviews | Identified users |
|---|---|---|---|
| Desktop | 375 (70%) | 3,679 | 13 |
| Mobile | 128 (24%) | 545 | 6 |
| Tablet | 40 (7%) | 47 | 1 |

Browser and OS are **not captured** in `site_analytics` (no user_agent column).
Mobile vs desktop conversion: signups split 3 desktop / 2 mobile / 1 unknown — **numbers are too small for a statistically meaningful comparison**; no evidence of a mobile-specific breakage, but two mobile users produced malformed routes (`/https://www.thrivein.io/circle/speed/...` and `/inbox/https://...`) — a real bug where a full URL is passed to a relative navigate.

---

## F. ENTRY PAGES

| Landing page | Visitors | Pageviews | Notes |
|---|---|---|---|
| `/` | 512 | 1,049 | 95% of all entries; ~90% bounce |
| `/auth` | 35 | 116 | |
| `/circle` + speed rooms | ~30 | 234 | Speed-session invite links |
| `/profile*` | 12 | 234 | Passport views |
| `/onboarding` | 9 | 19 | |
| `/about` | 8 | 35 | |
| `/desk` | 8 | 109 | |
| `/scout` | 6 | 142 | |
| `/credits` | 6 | 26 | |

---

## G. AUTH FUNNEL (deep dive)

| Metric | Value |
|---|---|
| Unique visitors to `/auth` | **35** |
| Of those, resolved to a logged-in user | 17 |
| Purely anonymous | 18 |
| `auth_page_loaded` events | 243 across 135 sessions (inflated by team + reloads) |
| `signin_attempt` | 54 |
| `signup_attempt` | **1** |
| `sign_in` success | 45 (7 distinct users) |
| `sign_up` success event | 1 |
| Accounts actually created | 6 |
| Email confirmed | 5 (1 pending: `l.jimenez@…`) |
| OAuth provider split of new accounts | 5 Google, 1 email/password |
| Auth errors logged | 9 `error_occurred` events total, month-wide |
| Created account but did not finish onboarding | **2 of 6** |

**Diagnosis:** the abandonment is *not* inside auth. Only 35 of 538 visitors ever reach `/auth` — that is the 93.5% loss. Inside auth, ~half of arrivals become users. Additional finding: `signup_attempt` fires once while `sign_in`/`signin_attempt` fire 54× → **the signup path is materially under-instrumented and OAuth signups never fire a signup event at all** (they emit `sign_in`), so "signups" are invisible in the event stream and only recoverable from `auth.users`.

---

## H. PASSPORT QUALITY (August accounts, n=6)

| Metric | Value |
|---|---|
| Passports claimed (pre-existing unclaimed profile) | **0** |
| New Passports created | 6 |
| Onboarding completed | 4 |
| Average credits per Passport | **0.0** |
| Passports with 0 credits | **6 (100%)** |
| 1–3 / 4–10 / 10+ credits | 0 / 0 / 0 |
| Identity verified | 0 |
| Credits verified | 0 |
| Co-sign requests / successes | 0 / 0 |
| Passport shares | not tracked |
| Location filled | 2 of 6 |

**This is the single most important finding in the report: nobody who signed up in August put a single credit on their Passport.** The product's core value object is empty for 100% of new cohort.

---

## I. RETENTION

| Cohort behaviour | Count |
|---|---|
| Returned same day | 3 |
| Returned Day 1+ | 1 (syarif.amudi) |
| Day 3 / Day 7 return | 0 / 0 |
| One-session users | 5 of 6 |
| Multi-session users | 1 |
| Avg sessions per registered user | ~1.8 |
| Avg pageviews per registered user | ~9 |
| Median time on page (all traffic) | 5.1s · mean 51.6s (skewed by idle tabs) |
| Sessions under 10s | 1,158 of 1,735 duration events (67%) |

---

## J. SCOUT / MARKETPLACE

| Metric | Aug 1–14 |
|---|---|
| Kretopia-native opportunities (all-time) | 20 |
| Externally scouted gigs (all-time) | 326 |
| Gig opens | 17 (3 users) |
| Gigs applied | 1 |
| Applications table inserts | 0 |
| Matches / conversations started | 0 messages sent all month |
| Projects created | 1 |
| Projects completed | 0 |
| Invoices | 1 |
| Verified credits generated from work | 0 |
| Speed-session RSVPs | 12 |

**Marketplace liquidity is effectively zero for new users.** Supply exists (326 scouted gigs) but demand-side engagement came from 3 mostly-internal accounts.

---

## K. TOP 5 CONVERSION LEAKS

| # | Leak | Users lost | % lost | Type | Fix |
|---|---|---|---|---|---|
| 1 | **Landing `/` → second pageview** | 486 of 538 | 90.3% | Unclear value + likely bot inflation | Instrument hero search + CTA immediately; add a no-auth "find yourself" result preview so the first action is a result, not a signup wall |
| 2 | **Any page → `/auth`** | 503 of 538 | 93.5% | UX friction / weak CTA | One dominant CTA above the fold; show a real Passport preview before asking to sign in |
| 3 | **`/auth` → account created** | 29 of 35 | 83% | Mixed: partly logged-in users revisiting, partly abandonment | Fire `signup_started` on method click; redirect already-authed users off `/auth`; surface OAuth errors visibly |
| 4 | **Account → first credit** | 6 of 6 | 100% | Onboarding gap | Make "add your first credit" the single mandatory onboarding step; pre-fill from the search that brought them in |
| 5 | **Account → co-sign / trust** | 6 of 6 | 100% | Downstream of #4 | Trigger the co-sign share sheet automatically after the first credit is saved |

Secondary technical bugs found:
- **Runaway `page_view` loop.** Three sessions logged 59,157 / 23,272 / 12,879 `page_view` events. `analytics_events` holds 134,483 rows for the period of which ~133,000 are duplicate loops from 3 internal sessions. `analytics_events` is currently unusable for traffic analysis.
- **`feature_used` fired 63,145 times across 52 sessions** — same runaway pattern.
- **`site_analytics` blocks the published Lovable domain.** `isPreviewOrBot()` filters any host containing `lovable.app`, so all traffic on `kretopia.lovable.app` is silently dropped. Only `kretopia.com` is counted.
- Malformed client routes containing full URLs (`/https://www.thrivein.io/...`).

---

## L. USER COHORTS

| Cohort | Count |
|---|---|
| Visitor Only (never went past one page) | 486 |
| High Intent Visitor (2+ pages, saw Passport or auth, no account) | ~29 |
| Signup Abandoner (reached /auth, no account) | 18 anonymous |
| Registered (account, no Passport content) | 2 |
| Passport User (onboarding completed) | 4 |
| Activated User (Passport + credit activity) | **0** |
| Trusted User (co-sign / verification / evidence) | **0** |
| Engaged User (returned or used Scout/Circle/Studio) | 1 |
| Marketplace User (opportunity or project interaction) | 0 new (3 pre-existing/internal) |
| Power User | 0 |

---

## M. DATA QUALITY — WHAT WE CANNOT MEASURE

| Funnel step | Tracked? |
|---|---|
| CTA clicks | ⚠️ only `bottom_get_started`; hero CTA not tracked |
| Search started / completed (hero "Find me") | ❌ |
| Passport preview shown | ❌ (only raw `/profile` pageview) |
| Claim click | ⚠️ `claim_started` exists but fired once |
| Auth start | ⚠️ page load only, not method selection |
| Signup submitted | ⚠️ email only; OAuth signups fire `sign_in` |
| Signup successful | ❌ (recoverable only from `auth.users`) |
| Passport claim successful | ❌ |
| Onboarding completion | ✅ |
| Credit creation | ❌ no event (table only) |
| Co-sign requested/completed | ❌ |
| Scout opportunity interaction | ✅ (`scouted_gig_actions`) |
| Studio/project creation | ⚠️ table only |
| Passport share | ❌ |
| Referral / UTM source | ❌ |
| Country | ❌ column exists, never populated |
| Browser / OS | ❌ not stored |

---

## N. RECOMMENDED FIXES BEFORE RELAUNCH

1. **Stop the `page_view` / `feature_used` loop** — a re-render is re-firing tracking. Until fixed, every event metric is noise.
2. **Un-block the published domain** in `isPreviewOrBot()` — allow `kretopia.lovable.app`, keep filtering `preview--*`, `lovable.dev`, and localhost.
3. **Populate `country`, `user_agent`, `browser`, `os`** on the analytics row (edge function using request IP + UA).
4. **Parse and persist UTMs + `?ref=`** on first touch into the visit row and onto the created profile.
5. **Instrument the top of the funnel** (events list in section O) — right now we are blind between "landing" and "auth".
6. **Make the first credit mandatory** in onboarding; auto-trigger the co-sign share sheet after it saves.
7. **Redirect authenticated users away from `/auth`** so the auth funnel measures only genuine prospects.
8. **Fix the malformed absolute-URL navigations** producing `/https://...` routes.
9. Add a bot filter (UA + single-hit heuristics) at query time so reporting separates humans from crawlers.

---

## O. EVENTS TO ADD BEFORE THE TRAFFIC PUSH

```
passport_search_started      { query_len, source: 'hero'|'nav' }
passport_search_completed    { result_count, latency_ms }
passport_viewed              { passport_id, is_claimed, viewer_authed }
passport_claim_clicked       { passport_id, source }
auth_started                 { method: 'google'|'email'|'apple', intent: 'claim'|'create' }
signup_submitted             { method }
signup_completed             { method, user_id }
passport_claimed             { passport_id }
passport_created             { user_id }
onboarding_step              { step, index }   // extend existing
onboarding_completed         { credits_added, skills_count }
credit_created               { source: 'manual'|'import'|'search' }
cosign_requested             { channel: 'whatsapp'|'email'|'link' }
cosign_completed             { credit_id }
scout_opportunity_viewed     { gig_id, source }
scout_opportunity_action     { action: 'save'|'apply'|'draft' }
studio_project_created       { workspace_type }
passport_shared              { channel }
referral_visit / referral_signup { ref_code }
```
Plus first-touch attribution fields on every row: `utm_source`, `utm_medium`, `utm_campaign`, `ref_code`, `country`, `browser`, `os`.

---

## P. INTERNAL FUNNEL DEBUG TABLE (external visitors with ≥2 pageviews; team excluded)

| Visitor | User | First → Last | Device | Source | Entry | Views | Sess | Passport | Auth | Account | Onboarded | Credits | Scout | Desk | Last stage | Drop-off |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25628515 | f85aa58d (Ahmad, Bali) | 05 Aug → 06 Aug | desktop | direct | / | 43 | 4 | Y | Y | Y | Y | 0 | N | N | Onboarded | No credit |
| 6e5c705a | a94da9d9 (Enguerran) | 11 Aug | desktop | oauth hop | / | 25 | 4 | Y | Y | Y | Y | 0 | N | N | Onboarded | No credit |
| 5055c028 | 0b8bf3ff (Gillian) | 10 Aug | mobile | thrivein.io | / | 22 | 9 | Y | Y | Y | **N** | 0 | N | N | Account created | Onboarding |
| 5c0ee420 | f5d3e1ec | 09 Aug | desktop | thrivein.io | / | 16 | 2 | N | Y | pre-Aug | — | 0 | Y | Y | Scout/Desk | No action |
| 46245b28 | — | 02 → 08 Aug | mobile | direct | / | 13 | 4 | N | Y | **N** | — | — | N | N | Auth page | Signup abandon |
| 05bcd223 | — | 13 Aug | mobile | direct | / | 11 | 2 | Y | Y | **N** | — | — | N | N | Auth page | Signup abandon |
| f63ed062 | 2b25b711 (Roman) | 13 Aug | desktop | oauth hop | / | 10 | 2 | Y | Y | Y | Y | 0 | N | N | Onboarded | No credit |
| efafeddf | d5ccbf33 | 11 Aug | mobile | direct | / | 9 | 3 | Y | Y | pre-Aug | — | 0 | N | Y | Desk | No action |
| 41623e3d | 9985d7a0 | 03 → 11 Aug | tablet | direct | / | 8 | 3 | Y | N | pre-Aug | — | 0 | Y | Y | Scout/Desk | No action |
| be35dad4 | d5ccbf33 | 10 → 12 Aug | mobile | direct | **/auth** | 8 | 7 | N | Y | pre-Aug | — | 0 | N | Y | Desk | No action |
| dd88e150 | 3f169d56 (benoit) | 11 Aug | mobile | oauth hop | / | 8 | 2 | N | Y | Y | Y | 0 | N | N | Onboarded | No credit |
| 645df41e | a150c5b2 | 06 Aug | desktop | direct | / | 7 | 4 | N | Y | pre-Aug | — | 0 | N | N | Signed in | No action |
| 699628c9 | — | 04 → 11 Aug | mobile | thrivein.io | / | 7 | 4 | N | N | N | — | — | N | N | Landing | Never reached auth |
| 69003e7b | — | 06 Aug | mobile | direct | / | 7 | 2 | N | N | N | — | — | N | N | Landing | Never reached auth |
| …+38 visitors with 2–6 views, all ending at Landing or Auth | | | | | | | | | | | | | | | | |
| 486 visitors | — | various | 70% desktop | 90% direct | / | 1 | 1 | N | N | N | — | — | N | N | Landing | Immediate exit |

Full row-level export SQL is in section N of this file's companion query set; no passwords, tokens or emails are included in the debug table above beyond internal IDs.

---

## THE ANSWER TO THE ONE QUESTION

> When someone discovers Kretopia, how successfully do we move them from curiosity → Creative Passport → trust → opportunity → real creative work?

**Curiosity → Passport: 1.1%. Passport → trust: 0%. Trust → opportunity: 0%. Opportunity → work: 0%.**

The loop is not broken at the end — it never starts. We convert a small number of people into empty Passports and nothing pulls them forward. Fix instrumentation, fix the landing's first action, and make the first credit + first co-sign the mandatory spine of onboarding before spending a dollar on traffic.
