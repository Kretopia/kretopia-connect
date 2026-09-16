# Kretopia Core Funnels v1.0
**Status:** Proposed · **Owner:** Growth + Product · **Date:** 2026-06-22 · **Phase:** 2 / Stabilize

Companion to `ACTIVATION_MODEL.md` and `ANALYTICS_EVENT_TAXONOMY.md`. Every step below maps to one (and only one) event in the taxonomy.

---

## 0. Funnel framework

- **Storage:** one row per (user_id, funnel_id, step_id) in a new `analytics_funnel_progress` table.
- **Derivation:** materialized view `funnel_<name>_daily` refreshed every 15 min for the dashboard.
- **Rule:** a user "enters" a funnel at step 1 and is counted in subsequent steps even if non-contiguous. We measure **conversion**, not strict sequence.
- **Window:** 30 days from step 1 by default; Scout funnel uses 14 days; Studio uses 60 days.

---

## 1. Passport Funnel (Acquisition → Activation)

The headline funnel. Mirrors the Activation Model.

| # | Step | Event | Source | Notes |
|---|---|---|---|---|
| 1 | Visitor lands | `page_view` w/ `path='/'` or `/u/:slug` | `site_analytics` | Includes unauth + auth |
| 2 | Sign Up started | `signup_started` | edge `auth-email-hook` / client | Email or Google clicked |
| 3 | Signed In | `user_signed_in` first time | `auth.users.created_at` | |
| 4 | Onboarding completed | `onboarding_completed` | `profiles.onboarding_completed_at` | Claimed Passport |
| 5 | First Stamp added | `credit_added` first | `credits` first row | |
| 6 | First Connection | `connection_made` first | `connections.status='accepted'` OR `swipes` mutual | |
| 7 | **Activated** | `user_activated` | `user_activation_status.is_activated` | All 4 signals true |

**Target conversions:**
- Visitor → Signup: 4% (industry baseline)
- Signup → Onboarding completed: 70%
- Onboarding → Activated: 50%
- **Visitor → Activated end-to-end: 1.4%**

**Diagnostic cuts:** by `landing_variant`, by `ambassador_code`, by `account_type`, by referral source.

---

## 2. Studio Funnel (Collaboration value loop)

| # | Step | Event | Source | Notes |
|---|---|---|---|---|
| 1 | Create Studio | `studio_created` | `projects` insert | Excludes seeded demo project |
| 2 | Add Collaborator | `studio_collaborator_added` | `project_collaborators` insert | Or guest link redeemed |
| 3 | Upload Asset | `studio_asset_uploaded` | `project_files` insert AND `is_link=false` | OR paste-link counts as half |
| 4 | Complete Task | `studio_task_completed` | `project_tasks` `status='done'` | |
| 5 | Deliver Project | `studio_project_delivered` | `projects.status='delivered'` OR a `project_deliverables` `status='approved'` | |

**Target conversions:**
- Create → Add collab: 60% (else it's a personal scratchpad)
- Collab → Upload: 80%
- Upload → Task complete: 70%
- Task → Delivered: 40%
- **Create → Delivered: 13%**

**Diagnostic cuts:** by `workspace_type` (content/campaign/music/event/podcast/general), by owner persona, by team size.

**Known anti-pattern to watch:** lots of "created" but no collaborator = users mis-using Studio as Notes. Should trigger a UX nudge.

---

## 3. Scout Funnel (Opportunity → Hire)

Already partially instrumented via [Scout Funnel Instrumentation] memory. We formalize here.

| # | Step | Event | Source | Notes |
|---|---|---|---|---|
| 1 | Discover (gig surfaced) | `gig_scouted` | `scouted_gig_actions.action='scouted'` | Auto-fired on row insert |
| 2 | Open Opportunity | `gig_opened` | action `'opened'` | |
| 3 | Draft started | `gig_drafted` | action `'drafted'` | Cover letter draft |
| 4 | Apply clicked | `gig_apply_clicked` | action `'apply_clicked'` | External link click OR internal apply |
| 5 | Applied (confirmed) | `gig_applied` | action `'applied'` OR `applications` insert | |
| 6 | Connected / Replied | `gig_reply_received` | message OR connection back from poster | |
| 7 | Hired (won) | `gig_won` | `scouted_gig_actions.outcome='won'` (user-reported) | Self-attested |

**Target conversions (14-day window):**
- Scouted → Opened: 25%
- Opened → Applied: 30%
- Applied → Replied: 15%
- Replied → Won: 30%
- **Scouted → Won: ~0.3%** (this is the moat metric)

**Diagnostic cuts:** by `source` (LinkedIn / IG / ATS / web), by tier (Spark/Creator/Creator+), by gig type (paid/exchange).

Already powered by `get_scout_funnel_stats` and `get_scout_funnel_by_source` RPCs — wire to dashboard.

---

## 4. Sound Stages Funnel (Live → Lasting connection)

The newest surface; instrumentation is sparse. Need to add events.

| # | Step | Event | Source | Notes |
|---|---|---|---|---|
| 1 | Joined a stage | `stage_joined` | `sound_stages` participant OR `speed_session_rsvps` | Includes Open Stage + Speed |
| 2 | Participated (≥ 60s on stage) | `stage_participated` | Daily.co duration via `daily-recording-webhook` | Filters lurkers |
| 3 | Connection sent | `stage_connection_sent` | `connections` insert w/ `context='sound_stage'` OR `speed_session_pairings` "want to connect" | Requires `context` column add |
| 4 | Collaboration | `stage_collab_created` | `projects` w/ `source='sound_stage'` OR Studio invite from stage attendee within 14d | Requires `source` column add |

**Target conversions (60-day window):**
- Joined → Participated: 60%
- Participated → Connection: 25%
- Connection → Collab: 15%
- **Joined → Collab: 2.25%**

**Schema gaps to file as Phase 3 tickets:**
- `connections.context` enum needs `'sound_stage'` value (already exists per memory — confirm).
- `projects.source` column to attribute origin (sound_stage / scout / desk / studio_brain).

---

## 5. Money Funnel (bonus — for Phase 6 prep)

Lightweight scaffolding only; full build during Phase 6.

| # | Step | Event |
|---|---|---|
| 1 | Connected payout | `wallet_bank_added` |
| 2 | First invoice sent | `invoice_sent` first |
| 3 | First invoice paid | `invoice_paid` first |
| 4 | First payout | `wallet_payout_completed` first |

---

## 6. Reporting deliverable

A single page at `/admin/analytics/funnels` rendering all 4 (5) funnels with:

- Stacked horizontal bar (step counts)
- Conversion % between steps
- 30-day trend sparkline per step
- Persona filter (Creator / Company / Recruiter / Community)
- CSV export

Implementation owner: Phase 2 Step 4 (see ANALYTICS_DASHBOARD_PLAN.md).

---

## 7. Out of scope

- Multi-touch attribution (which channel "caused" activation) — needs UTM plumbing first.
- Cohort lifetime value — Phase 6.
- Ambassador funnel — already has dedicated `ambassador_applications` and reward tables.
