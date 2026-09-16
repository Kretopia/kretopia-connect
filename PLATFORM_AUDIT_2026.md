# Kretopia Platform Audit & Stabilization Review
**Date:** June 22, 2026 · **Stage:** Pre-scale (beta → growth)
**Auditor lens:** Principal Architect · CTO · Staff Eng · Security · UX · YC Partner

> Verdict up top: **Kretopia is a category-defining product hiding inside a sprawling beta surface.** The moat (Credits + Passport + Scout + Studio + Pay) is real. The risk is sprawl: 158 routes, 291 edge functions, 660 migrations, 65 hooks, 320+ tables — built faster than they were consolidated. The next 90 days are not about *building*, they're about *deleting, merging, and hardening*.

---

## PHASE 1 — PLATFORM INVENTORY

### 1.1 Frontend (snapshot)
| Surface | Count | Status |
|---|---|---|
| Routes in `App.tsx` | **158** | 🔴 ~40 are redirects/aliases — legacy debt |
| Pages | ~150 | 🟡 Many one-off (TestEmails, BrandVerify, SpeedRecap) |
| Components | ~700+ `.tsx` | 🟡 No dead-code sweep in 6 months |
| Hooks | 65 | 🟡 Overlap: `useStreakUpdate` vs `daily_streaks`, `useProjectLimit` vs `useFeatureGate` |
| Hardcoded color literals | 24 files | 🟡 Drift vs Brand System v1 |

**Deprecated / hidden but still routed:** `/challenges/*`, `/market/*`, `/agent`, `/thrive-ai`, `/checkin`, `/dashboard` (alias), `/analytics`, `/admin-broadcast`, `/waitlist-admin`, `/magazine`, `/podcast` (now tabs), `/wallet`, `/purchases`, `/accounting`, `/thrivemoney`, `/explore`, `/events`, `/circles`, `/circle/:id` (legacy).
→ **~28 routes are alias-only.** Move to a single `<RedirectMap>` table; delete dead page imports.

**Duplicate UI patterns found:**
- 3 folder/collection grids (StudioFoldersBar, asset_folders UI, project_file_folders UI)
- 2 video call entry points (`/meet/:id`, `/call/:token`) — fine, but 4 different "join call" components
- 2 stage systems: `sound_stages` + `curated_stages` + `speed_sessions` (3 tables, 1 mental model)
- 2 messages systems: `messages` (DMs) + `spark_room_messages` (rooms) + `session_messages` + `telegram_messages` + `project_messages` = **5 message tables**
- 2 streak systems: `daily_streaks` + `money_streaks`

### 1.2 Backend — Edge Functions: **291** (🔴 severe)
That's ~1 fn per 1.2 tables. Industry sane is 30–80 for a product this size.

**Consolidation candidates (visible patterns):**
- `create-*-room` (circle, video, direct, guest) → one `create-room` with kind
- `checkout-*` (event-tickets, stage-ticket, create-checkout, capture-*-payment) → one `payments-gateway`
- `agent-*` (rsvp-event, send-dm, vouch-credit, orchestrator) → already have `agent-orchestrator`; collapse the rest into tools
- `auto-*` watchers (discover, epk-updater, outreach-watch, resolve-disputes) → one `cron-watcher` dispatcher
- `bulk-*` / `batch-*` → one `bulk-runner` with task type
- AI: `ai-autofill-profile`, `ai-credit-import`, `ai-finance`, `ai-markup-suggest`, `ai-pricing-copilot`, `ai-support`, `ai-talent-match`, `analyze-profile-url`, `auto-discover-creatives` — overlapping prompts, no shared model router
- `_shared/` exists but is underused — most fns re-declare CORS, supabase client, error handling

**Target:** 291 → **~90** in 60 days.

### 1.3 Database
- **320+ tables**, **660 migrations** (every feature created tables instead of extending)
- Repeated patterns: `*_comments` (10 tables), `*_reactions` (5), `*_approvals` (3) → could be polymorphic `reactions(target_type, target_id)` + `comments(target_type, target_id)`
- `profiles` has **174 columns** 🔴 — needs split into `profiles_core`, `profiles_creative`, `profiles_company`
- Storage quota good (unified trigger ✅), but `tracked_storage_buckets` only has 3 cols — review coverage of newer buckets
- RLS coverage: most tables 2–5 policies; **`stripe_webhook_events`, `guest_wallet_*` (4 tables)** show **0 policies in the snapshot** 🔴

### 1.4 AI Systems
| System | Status | Issue |
|---|---|---|
| `agent-orchestrator` + tool registry (`orch_tool_registry`) | Active | ✅ Cleanest layer |
| `thrive-ai-chat` (Talk) | Active | Per-tier caps via `consume_copilot_message` ✅ |
| `thrive-document-engine` (EP docs) | Active | Now reads `studio_brain` ✅ |
| `studio-ingest` (Studio Brain) | Active (Phase A/B) | No eval harness |
| `thrive-memory` | Active | No GC, no scoping audit, no decay |
| `thrive-voice-turn` | Active | Recently switched off ElevenLabs (billing block) — verify single provider end-to-end |
| `copilot-planner` / `copilot-executor` | Active | Parallel path to orchestrator → unclear ownership |
| Scout (`scout-gigs`, `draft-gig-application`) | Active | ✅ Real product moat |
| Sponsor Radar / Auto-EPK / Intel digest | Active | Cron-heavy, no shared dispatcher |
| Pricing Co-Pilot | Active | Reads `thrive_memory` ✅ |
| Desk Agent Watch | Active | 15min/30min throttle — verify in prod |

**Critical AI gap:** No central **model router**. Model choice (`gemini-2.5-pro` vs `flash` vs `flash-lite`) is hardcoded per function — cost/perf can't be tuned without 291 edits.

---

## PHASE 2 — USER JOURNEY HEALTH

Scored 1–5 (5 = polished). E2E spot-checks + replay + code review.

| Persona | Onboarding | Activation | Daily loop | Score |
|---|---|---|---|---|
| Guest | 4 | 3 | n/a | 🟢 |
| Creator | 3 | 4 | 3 | 🟡 |
| Brand | 2 | 2 | 2 | 🔴 |
| Agency | 1 | 1 | 1 | 🔴 |
| Community Leader | 3 | 3 | 2 | 🟡 |
| Recruiter | 2 | 2 | 2 | 🔴 |
| Event Organizer | 4 | 3 | 3 | 🟢 |
| Company Profile | 2 | 2 | 2 | 🔴 |

### Critical broken/friction flows
1. **🔴 Studio folder DnD (current thread):** moved through 4 iterations — needs final verification on touch & desktop. Drop-zone hit area, drag image, undo affordance.
2. **🔴 Match → Message → Studio handoff:** message a match → no "Start a Studio with them" CTA in chat header.
3. **🔴 Brand/Agency posting a gig:** flow ends at "posted." No applicant pipeline view tailored to companies, no shortlist export.
4. **🟠 Passport public view vs EPK view vs Share view** are 3 different layouts — single source of truth needed.
5. **🟠 Scout → Apply → Track:** scouted gig "applied" status doesn't surface in Today/Desk.
6. **🟠 Wallet onboarding (Stripe Connect controller):** silent failures land users in a stuck state — needs status poller + retry CTA.
7. **🟠 Onboarding seeded experience** is good (RPC `seed_new_user_experience`) — but only fires once; failures leave empty home.
8. **🟡 Communities hidden** (memory) but still routed (`/crews`, `/circle`) — confusing for new users who land via shared links.

### Dead ends (no next step shown)
- `/admin/weekly-note` (no admin guard fallback)
- `/podcast`, `/magazine` redirect to `/spotlight` but old shared links break SEO
- `/ambassadors` waitlist with no post-submit confirmation flow
- `/dispute/:creditId` → no progress indicator

---

## PHASE 3 — PASSPORT AUDIT

**Owner view:** strong. Edit-in-place, sections clear.
**Public view:** information-dense but signal-poor. Top fold doesn't lead with proof.
**EPK view:** beautiful, but **portfolio-first** drowns identity for recruiters in 4s.
**Recruiter view:** missing — recruiters see public view, not a recruiter-optimized lens.
**Brand view:** same — no rate card prominence, no availability, no "Hire" primary CTA above the fold.

### Missing proof / trust signals
- Verified email/phone/payout — exists in DB, not surfaced as a single trust badge row
- Co-signs count + names (Stamps engine) — buried
- Recent paid receipts (no $$ values, just count) — would crush social proof
- Repeat collaborators — `Collabs` tab exists, not in hero
- Response time + on-time delivery rate — not computed
- "Last active" — sometimes shown, not always

### Profession-specific gaps
| Profession | Missing |
|---|---|
| Photographers | Print/usage rights, location radius |
| Musicians | Splits & masters ownership, ISRC, live-vs-studio toggle |
| Models | Polaroids/digitals, measurements lockout per client tier |
| Producers | Reel reel reel — needs autoplay 6-sec hero |
| Directors | Treatment library link |
| Brand/Agency | Case-study format, NDA-gated work |

### Passport V4 priorities (impact-ranked)
1. **Recruiter lens** (route param `?view=recruiter`) — Hire CTA, rates, availability, response time
2. **Trust row** — one bar with all verifications + Stamps count + receipts count
3. **Profession-aware hero block** swap (already have taxonomy)
4. **6-sec autoplay reel** above the fold
5. **One-tap "Co-sign"** for connected viewers
6. **Single Passport renderer** powering owner/public/EPK/share/recruiter views — kill the duplication

---

## PHASE 4 — STUDIO AUDIT

Tested mental walk-throughs for 6 workflow types:

| Workflow | Can run E2E in Kretopia? | Gap |
|---|---|---|
| **Event** | 🟢 90% | RSVP + roster + chat + photo wall ✅. Missing: ticket scanning offline mode |
| **Podcast** | 🟢 85% | Podcast slice (episodes, gen questions) ✅. Missing: hosting/RSS, transcript-to-clips publishing |
| **Music Video** | 🟡 60% | Brief + tasks + shotlist ✅. Missing: call sheet → crew confirmation loop, locations marketplace integration |
| **Brand Campaign** | 🟢 80% | Campaign slice (brief/matrix/approve) ✅. Missing: media plan budget, post-buy reporting |
| **Documentary** | 🟡 50% | Long-form timeline, release management, rights clearance — none |
| **Startup Launch** | 🔴 30% | No fundraising-style milestone tracker beyond ThriveFund; no "investor updates" |

**DropZone / Brief / Tasks / Deliverables** are the strongest pillar — `studio-ingest` unifying ingestion is the single best architectural move on the platform.

**Studio gaps:**
- **No deliverable approvals SLA timer**
- **No client portal lite** (clients see Studio as guests, but no white-label option)
- **Transcript → action items → tasks** loop exists in code but doesn't fire reliably in prod (check `call-action-items` write path)
- **Memory** has no UI for users to view/edit what Thrive knows (privacy + trust risk)

---

## PHASE 5 — EXECUTIVE PRODUCER MATURITY

### EP capability matrix
| Capability | Score (0–10) | Notes |
|---|---|---|
| Plan | 7 | `copilot-planner` + tool registry, no plan persistence UI |
| Organize | 8 | Studio Brain + folders |
| Recommend | 6 | Proactive cards good, but recommendations don't learn from accept/dismiss |
| Automate | 5 | Watchers exist; no user-facing automation builder |
| Follow up | 4 | Desk daily nudge cron 14:00 UTC — single touchpoint |
| Remember | 6 | `thrive_memory` good, no decay/scoping/redaction |
| Execute | 7 | Tool calls work; no rollback, no dry-run preview for destructive tools |

**Maturity Score: 61 / 100**

### Roadmap to 100
- **+10** Central **model router** with per-task cost ceiling + fallback chain
- **+8** **Eval harness**: golden traces for orchestrator, document-engine, scout
- **+6** **Memory UI** (view/edit/forget) + auto-decay + per-scope quotas
- **+5** **Plan persistence** with rerun/edit
- **+4** **Outcome learning**: store accept/dismiss → re-rank proactive cards
- **+3** **Dry-run** for destructive tools (invoice send, document share, mass DM)
- **+3** **Cost dashboard** per fn/per user/per tier

---

## PHASE 6 — ANALYTICS HEALTH

| Metric | Can we measure? |
|---|---|
| DAU/WAU/MAU | 🟡 via `user_session_pings`, but no cohort retention |
| Activation | 🔴 No defined activation event |
| Retention (D1/D7/D30) | 🔴 No materialized view |
| Revenue | 🟢 invoices + payment_history |
| Feature adoption | 🟡 `analytics_events` exists, sparsely instrumented |
| Funnels | 🔴 No funnel definition layer |
| Engagement (depth) | 🔴 No session length / actions-per-session |

**Score: 38/100.**

Fix:
1. Define **activation = (claimed profile) + (1 credit) + (1 connection)** — track on `profiles`
2. Materialize `retention_cohorts` view
3. Standard `analytics_events` taxonomy + linter
4. Funnel viewer in `/admin`

---

## PHASE 7 — SECURITY & SCALE

### Critical
- 🔴 `stripe_webhook_events`, `guest_wallet_*` have **0 RLS policies** in snapshot — verify and lock down
- 🔴 `profiles` (174 cols, 8 policies) — risk of accidental column leak. Move PII to `profiles_sensitive` table behind security-definer functions
- 🔴 291 edge functions — many auto-deployed with `verify_jwt = false`. Audit each.

### High
- 🟠 Memory access (`thrive_memory`): ensure tools cannot read other users' memory through indirect SQL
- 🟠 Storage: unified quota ✅ but new buckets must be added to `tracked_storage_buckets` — automate via trigger
- 🟠 Voice/AI per-tier caps exist for chat — confirm enforcement for voice, scout-gigs, document-engine
- 🟠 Role checks: confirm every admin edge fn uses `requireAdminOrCron`

### Medium
- 🟡 `console.log` calls (95 files) leak PII risk
- 🟡 No rate limiting at edge-fn layer (rely on Supabase defaults)
- 🟡 95% of file uploads go via `storage.from(...).upload` — no virus/EXIF scrub

### Scale readiness
| Users | Verdict |
|---|---|
| 1k | 🟢 Today |
| 10k | 🟡 Edge fn fan-out + cron concurrency will smoke; cost will spike on Gemini Pro routes |
| 100k | 🔴 320 tables w/o partitioning, profile bloat, no read replicas, no CDN for portfolio assets at scale |

---

## PHASE 8 — PRODUCT CLARITY

### The 5 core Kretopia should be known for
1. **Creative Passport** (identity + proof + EPK)
2. **Credits & Co-signs** (verified track record — the moat)
3. **Studio** (the work happens here, with EP brain)
4. **Scout** (gigs come to you, real ones)
5. **Pay** (get paid, frictionless, even cross-border)

Everything else = supporting cast.

### Merge
- Magazine + Podcast → Spotlight ✅ (done — finish redirects)
- 5 message tables → 2 (`messages`, `room_messages`) with channel ref
- `sound_stages` + `curated_stages` + `speed_sessions` → unified `live_rooms(kind)`
- `copilot-planner/executor` + `agent-orchestrator` → one orchestration runtime
- 10 `*_comments` tables → polymorphic `comments`

### Hide
- `/sales`, `/leads`, `/rolodex`, `/outreach` (4 routes, same page) → keep one in nav
- `/website-builder`, `/brand-vault`, `/talent-manager`, `/creative-circle` → behind "Pro tools" drawer
- `/ambassadors` + `/ambassador` + `/founding-member` — collapse into one "Programs" page

### Remove
- `/challenges/*`, `/checkin`, `/agent`, `/thrive-ai`, `/analytics`, `/admin-broadcast`, `/waitlist-admin`, `/explore`, `/events` (legacy), `/wallet`, `/purchases`, `/thrivemoney`, `/accounting`
- Dead components: run a `ts-prune` pass (will likely flag 80+ exports)

### Move
- `/admin/*` family → single Admin shell with tabs
- All "create" CTAs → one global `+` FAB that routes by context

---

## PHASE 9 — EXECUTIVE SUMMARY

### Overall Platform Score: **68 / 100**
A strong, opinionated product with real moat — held back by sprawl, untracked debt, and partial observability.

### Category scores
| Category | Score |
|---|---|
| Product (vision + moat) | **84** |
| Engineering (code health, modularity) | **58** |
| UX (clarity, friction) | **66** |
| AI (orchestration, memory, EP) | **61** |
| Security | **62** |
| Scalability | **52** |
| Analytics | **38** |
| Brand | **82** |
| **Weighted avg** | **68** |

### Top 10 CRITICAL fixes (do or scale will break)
1. RLS audit pass on `stripe_webhook_events`, `guest_wallet_*`, every table with <2 policies
2. Central **model router** + per-tier cost caps for *all* AI fns (not just chat)
3. Split `profiles` (174 cols) → core/creative/company/sensitive
4. Verify Studio folder DnD end-to-end (current thread)
5. Define + instrument **activation event** + D1/D7/D30 cohorts
6. Single Passport renderer (owner/public/EPK/share/recruiter views)
7. Polymorphic `comments` + `reactions` consolidation
8. Edge-fn audit: which `verify_jwt=false` and why, add admin-guard everywhere
9. Memory UI + decay/scoping for `thrive_memory`
10. Brand/Agency applicant pipeline view (currently a dead end)

### Top 10 QUICK WINS (≤1 day each)
1. Delete 28 alias routes → `<RedirectMap>` table
2. `ts-prune` + delete dead components (target -10% LOC)
3. Trust row component on Passport (verifications + Stamps + receipts count)
4. "Start a Studio with them" CTA in chat header
5. Scout "applied" status surfaces on Today + Desk
6. Replace 95 `console.log` with `errorLogger`
7. Wallet onboarding status poller + retry CTA
8. Recruiter `?view=recruiter` Passport variant (CTA + rates above fold)
9. Funnel definitions in admin (`signup → claim → 1 credit → 1 connection`)
10. Single global `+` FAB with context-aware actions

### 30-day plan — STABILIZE
- Week 1: Audit findings triaged into Linear; freeze new routes & tables
- Week 2: RLS + edge-fn JWT audit + console.log purge
- Week 3: Route cleanup, dead code, Passport renderer unification
- Week 4: Analytics instrumentation + activation event live

### 60-day plan — CONSOLIDATE
- Edge functions 291 → ~90
- Tables: comments/reactions polymorphism, profiles split
- Live-rooms unification, messages unification
- Model router + cost dashboard
- Memory UI + decay
- Recruiter & Brand lenses on Passport
- Applicant pipeline for companies

### 90-day plan — SCALE
- Read replicas, asset CDN, image pipeline
- Eval harness on EP + Scout + Document Engine
- Outcome learning loop on proactive cards
- Client portal lite + Studio white-label
- Documentary + Startup workflow slices
- Public Trust dashboard ("X creators paid this month, Y co-signs minted")

### Prioritization matrix (top items)
| Item | Impact | Effort | Risk | Do |
|---|---|---|---|---|
| Model router | 10 | 5 | 2 | **Now** |
| RLS audit | 10 | 3 | 1 | **Now** |
| Profiles split | 9 | 8 | 6 | 60d |
| Passport renderer | 9 | 5 | 3 | 30d |
| Edge-fn consolidation | 8 | 9 | 5 | 60–90d |
| Analytics activation | 9 | 3 | 1 | **Now** |
| Memory UI | 7 | 4 | 2 | 30d |
| Live-rooms merge | 6 | 7 | 4 | 60d |
| Recruiter lens | 8 | 3 | 1 | **Quick win** |
| Comments polymorphism | 5 | 8 | 6 | 90d |

---

## Closing
Kretopia does not have a vision problem. It has a **surface area problem**. The next 90 days should ship **one new feature** (Recruiter Lens) and **delete more than you add**. After that, the Creative Operating System story becomes inevitable.
