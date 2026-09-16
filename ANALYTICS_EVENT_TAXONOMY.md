# Kretopia Analytics Event Taxonomy v1.0
**Status:** Proposed · **Owner:** Data + Eng · **Date:** 2026-06-22 · **Phase:** 2 / Stabilize

> Single source of truth for every event name fired by the app, edge functions, or DB triggers.
> Anything not in this document **must not** be sent to `analytics_events`. Anything in `site_analytics` is *pageviews and durations only* and is out of scope.

---

## 0. Current state audit

Before defining the new taxonomy, here's what exists today:

| System | Storage | Status | Recommendation |
|---|---|---|---|
| `site_analytics` (`scope='platform'`) | DB table | ✅ Healthy — pageviews + duration | **Keep.** Scope `'platform'` only. |
| `site_analytics` (`scope='site'`) | DB table | ✅ Used by creator-site builder | **Keep, isolated.** Different product. |
| `analytics_events` | DB table | 🟡 Ad-hoc, no taxonomy | **Rebuild around this doc.** |
| `event_analytics_events` | DB table | 🟡 Used only by /events product | **Keep, namespace.** Rename to `irl_event_analytics` later. |
| `share_link_views` / `opportunity_views` / `profile_view_tracking` | DB tables | 🔴 Duplicate concept × 3 | **Phase 3 — consolidate to `analytics_events` `*_viewed` events.** |
| `deckMetrics.ts` client tracking | Custom client lib | 🔴 Writes to nothing persistent | **Migrate to `analytics_events` `deck_*` events.** |
| `desk_ai_usage`, `voice_usage_daily`, `bulk_email_usage`, `curated_stage_app_usage` | DB tables | 🟡 Quota / billing tables, not analytics | **Keep as quota tables — also emit a `*_consumed` event for analytics.** |
| Edge function `console.log` | Logs | 🔴 Not queryable as analytics | **Replace with `analytics_events` inserts.** |
| Passport / Scout / Studio analytics | None (implicit) | 🔴 Not tracked | **Built from new events.** |

**Net:** one canonical table (`analytics_events`), one pageview table (`site_analytics` platform scope), one IRL events table kept namespaced. Everything else gets consolidated in Phase 3.

---

## 1. Event row schema

```sql
analytics_events (
  id              uuid primary key,
  event_name      text   not null,   -- snake_case, from this doc
  category        text   not null,   -- one of the 12 categories below
  user_id         uuid   null,       -- null = anon / system / cron
  session_id      text   null,       -- matches site_analytics
  properties      jsonb  not null default '{}'::jsonb,
  source          text   not null,   -- 'client' | 'server' | 'edge_fn:<name>' | 'trigger:<name>' | 'cron'
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
```

Properties are typed per event below. Unknown properties are dropped at the validation layer (Zod schema in `src/lib/analytics.ts`, to be created).

---

## 2. Categories

| Category | Owner system | Events |
|---|---|---|
| Identity | Auth / Profile | 8 |
| Passport | Profile / EPK / Stamps surface | 12 |
| Credits | Stamps (ICDB) | 9 |
| Connections | Network / Match / Messages | 11 |
| Studio | ThriveDesk / Projects | 14 |
| Scout | Gigs + Scouted gigs | 9 |
| SoundStages | Live + Speed sessions | 7 |
| Pay | ThrivePay / Wallet / Invoices | 11 |
| Community | Circles + Events + Spotlight | 9 |
| ExecutiveProducer | Thrive agent + outreach | 8 |
| DocumentGen | thrive-document-engine | 5 |
| Voice | Thrive voice push-to-talk | 4 |
| Memory | thrive_memory | 3 |

Total: **110 canonical events.** Anything beyond this list requires a PR to this file.

---

## 3. Event catalog

### 3.1 Identity (Auth lifecycle, ownership)

| event_name | properties | owner | fires from |
|---|---|---|---|
| `signup_started` | `{method: 'email'\|'google'\|'magic'}` | Growth | client (Auth.tsx) |
| `user_signed_up` | `{method, ambassador_code?, utm?}` | Growth | trigger on `auth.users` insert |
| `user_signed_in` | `{method, days_since_last}` | Growth | client |
| `onboarding_started` | `{persona?}` | Onboarding | client |
| `onboarding_completed` | `{persona, duration_sec}` | Onboarding | client / `seed_new_user_experience` |
| `user_activated` | see ACTIVATION_MODEL.md §5.2 | Growth | trigger on `user_activation_status` flip |
| `profile_claimed` | `{claim_method: 'discovered'\|'new'}` | Trust | edge `claim-and-create-profile` |
| `account_deleted` | `{reason?}` | Trust | edge / DB |

### 3.2 Passport

| event_name | properties | owner | fires from |
|---|---|---|---|
| `passport_viewed` | `{owner_id, viewer_persona, surface}` | Passport | client (consolidate `profile_view_tracking`) |
| `passport_edited` | `{section}` | Passport | client |
| `passport_strength_bumped` | `{from, to, trigger}` | Passport | trigger on `profiles.verification_score` change |
| `passport_shared` | `{channel: 'link'\|'qr'\|'whatsapp'\|'email'\|'pdf'}` | Passport | client |
| `passport_pdf_exported` | `{pages, has_rates}` | Passport | client (jsPDF) |
| `passport_recruiter_view_toggled` | `{enabled}` | Passport | client (Phase 5 quick win) |
| `passport_vouch_received` | `{from_user_id}` | Passport | trigger on `credit_vouches` |
| `passport_cosign_given` | `{credit_id, to_user_id}` | Passport | trigger |
| `passport_press_added` | `{provider}` | Passport | client |
| `passport_rate_card_added` | `{currency, service}` | Passport | client |
| `passport_availability_set` | `{window_days}` | Passport | client |
| `passport_video_intro_added` | — | Passport | client |

### 3.3 Credits (Stamps / ICDB)

| event_name | properties | owner | fires from |
|---|---|---|---|
| `credit_added` | `{role, year, project_type, source: 'manual'\|'discovered'\|'imported'}` | Credits | trigger on `credits` insert |
| `credit_imported_bulk` | `{count, source}` | Credits | edge `bulk-import-profiles` |
| `credit_discovered` | `{source, confidence}` | Credits | edge `discover-creators` etc. |
| `credit_verified` | `{method: 'ai'\|'brand'\|'co_sign'}` | Trust | edge `verify-credit` |
| `credit_vouched` | `{credit_id, voucher_id}` | Trust | trigger |
| `credit_endorsed` | `{credit_id, skill}` | Trust | trigger |
| `credit_disputed` | `{credit_id, reason}` | Trust | client |
| `credit_share_clicked` | `{credit_id, channel}` | Growth | client |
| `production_page_viewed` | `{production_id}` | Credits | client |

### 3.4 Connections

| event_name | properties | owner | fires from |
|---|---|---|---|
| `swipe_made` | `{direction, target_user_id, surface}` | Match | client |
| `match_made` | `{a, b}` | Match | trigger on mutual `swipes` |
| `icebreaker_sent` | `{match_id}` | Match | client (MatchModal sends on tap) |
| `connection_requested` | `{to_user_id, context}` | Network | trigger on `connections` insert |
| `connection_accepted` | `{from_user_id, context}` | Network | trigger |
| `connection_made` | (first ever) | Activation | trigger |
| `message_sent` | `{room_type, has_attachment}` | Messages | trigger on `messages` insert |
| `message_first_reply_to_request` | `{request_id}` | Messages | trigger |
| `silent_decline` | `{request_id}` | Messages | server (per memory) |
| `direct_call_started` | `{to_user_id}` | Calls | edge `create-direct-video-call` |
| `direct_call_answered` | `{duration_sec}` | Calls | webhook |

### 3.5 Studio (ThriveDesk / Projects)

| event_name | properties | owner | fires from |
|---|---|---|---|
| `studio_created` | `{workspace_type, source}` | Studio | trigger on `projects` insert (not seeded) |
| `studio_collaborator_added` | `{role, via: 'invite'\|'guest_link'}` | Studio | trigger |
| `studio_asset_uploaded` | `{bucket, bytes, mime}` | Studio | trigger on `project_files` |
| `studio_link_pasted` | `{provider}` | Studio | edge `fetch-link-metadata` |
| `studio_task_created` | `{source: 'manual'\|'voice'\|'agent'\|'brief'}` | Studio | trigger |
| `studio_task_completed` | `{age_hours}` | Studio | trigger |
| `studio_brief_dropped` | `{kind: 'pdf'\|'image'\|'voice'\|'link'\|'deck'}` | Studio | edge `studio-ingest` |
| `studio_brief_fact_recorded` | `{kind, count}` | Studio | edge `studio-ingest` |
| `studio_deliverable_approved` | `{deliverable_id}` | Studio | trigger |
| `studio_project_delivered` | `{duration_days, collaborators}` | Studio | trigger |
| `studio_chat_message_sent` | — | Studio | trigger |
| `studio_video_call_started` | `{participants}` | Calls | edge |
| `studio_share_link_created` | `{scope}` | Studio | trigger |
| `studio_share_link_viewed` | `{token}` | Studio | edge (consolidate `share_link_views`) |

### 3.6 Scout

| event_name | properties | owner | fires from |
|---|---|---|---|
| `gig_scouted` | `{source, score}` | Scout | trigger on `scouted_gigs` (consolidate w/ `scouted_gig_actions`) |
| `gig_opened` | `{gig_id}` | Scout | client |
| `gig_drafted` | `{gig_id, drafted_by: 'ai'\|'user'}` | Scout | edge `draft-gig-application` |
| `gig_apply_clicked` | `{gig_id, external}` | Scout | client |
| `gig_applied` | `{gig_id}` | Scout | client / trigger on `applications` |
| `gig_reply_received` | `{gig_id}` | Scout | trigger |
| `gig_outcome_recorded` | `{outcome: 'won'\|'lost'\|'ghosted'}` | Scout | client |
| `gig_posted` | `{type: 'paid'\|'exchange', budget?}` | Marketplace | trigger on `opportunities` |
| `gig_applicant_reviewed` | `{decision}` | Marketplace | trigger |

### 3.7 SoundStages

| event_name | properties | owner | fires from |
|---|---|---|---|
| `stage_created` | `{type: 'open'\|'speed'\|'curated'}` | Stages | trigger |
| `stage_joined` | `{stage_id, type}` | Stages | edge `join-sound-stage` / `join-speed-session` |
| `stage_participated` | `{stage_id, duration_sec}` | Stages | webhook `daily-recording-webhook` |
| `stage_connection_sent` | `{from, to, stage_id}` | Stages | trigger |
| `stage_collab_created` | `{stage_id, project_id}` | Stages | trigger (via `projects.source='sound_stage'`) |
| `stage_highlight_clipped` | `{stage_id}` | Stages | edge `transcribe-call` |
| `stage_recap_distributed` | `{stage_id, attendees}` | Stages | edge |

### 3.8 Pay

| event_name | properties | owner | fires from |
|---|---|---|---|
| `wallet_bank_added` | `{country}` | Pay | edge `wallet-add-bank` |
| `wallet_topup_started` | `{amount, currency}` | Pay | edge `wallet-topup` |
| `wallet_topup_succeeded` | `{amount, currency}` | Pay | webhook `stripe-wallet-webhook` |
| `wallet_transfer_sent` | `{amount, currency, to_user_id}` | Pay | edge `wallet-transfer` |
| `wallet_payout_started` | `{amount, currency}` | Pay | edge `wallet-payout` |
| `wallet_payout_completed` | `{amount, currency}` | Pay | webhook |
| `invoice_created` | `{amount, currency, has_milestones}` | Pay | trigger on `invoices` |
| `invoice_sent` | `{invoice_id, channel}` | Pay | client |
| `invoice_paid` | `{invoice_id, processor, fees}` | Pay | webhook |
| `escrow_created` | `{amount, milestones_count}` | Pay | edge |
| `escrow_released` | `{milestone_id, amount}` | Pay | edge |

### 3.9 Community (Circles + IRL events + Spotlight)

| event_name | properties | owner | fires from |
|---|---|---|---|
| `circle_joined` | `{circle_id, gated: bool}` | Community | trigger |
| `circle_post_created` | `{circle_id}` | Community | trigger |
| `event_published` | `{event_id, format, paid: bool}` | Events | trigger on `creative_jams` |
| `event_rsvp` | `{event_id, tier?}` | Events | edge `rsvp_to_event` |
| `event_check_in` | `{event_id, method: 'qr'\|'manual'}` | Events | client |
| `event_share_clicked` | `{event_id, channel, ref?}` | Events | client |
| `magazine_article_viewed` | `{article_id}` | Spotlight | client |
| `magazine_article_shared` | `{article_id, channel}` | Spotlight | client |
| `podcast_episode_played` | `{episode_id, duration_sec}` | Spotlight | client |

### 3.10 ExecutiveProducer (Thrive agent)

| event_name | properties | owner | fires from |
|---|---|---|---|
| `thrive_intent_routed` | `{intent, destination}` | Thrive | edge `route-thrive-intent` |
| `thrive_proposal_created` | `{kind, project_id}` | Thrive | edge `desk-agent-watch` |
| `thrive_proposal_accepted` | `{proposal_id, kind}` | Thrive | client |
| `thrive_proposal_dismissed` | `{proposal_id, kind}` | Thrive | client |
| `thrive_action_executed` | `{tool, status}` | Thrive | edge `agent-orchestrator` |
| `thrive_outreach_drafted` | `{lead_id, channel}` | Thrive | edge |
| `thrive_outreach_sent` | `{lead_id, channel}` | Thrive | edge |
| `thrive_chat_message` | `{role, tokens, model}` | Thrive | edge `thrive-ai-chat` |

### 3.11 DocumentGen

| event_name | properties | owner | fires from |
|---|---|---|---|
| `document_generated` | `{document_type, model, tokens}` | DocGen | edge `thrive-document-engine` |
| `document_shared` | `{document_id, channel}` | DocGen | client |
| `document_viewed_public` | `{token}` | DocGen | edge (consolidate w/ `share_link_views`) |
| `document_pdf_exported` | `{document_id, pages}` | DocGen | client |
| `document_version_saved` | `{document_id, version}` | DocGen | trigger |

### 3.12 Voice

| event_name | properties | owner | fires from |
|---|---|---|---|
| `voice_turn_started` | `{surface}` | Voice | client |
| `voice_turn_completed` | `{duration_sec, words}` | Voice | edge `thrive-voice-turn` |
| `voice_seconds_consumed` | `{seconds, tier_remaining}` | Voice | RPC `consume_voice_seconds` |
| `voice_quota_hit` | `{tier}` | Voice | RPC |

### 3.13 Memory

| event_name | properties | owner | fires from |
|---|---|---|---|
| `memory_remembered` | `{kind, key}` | Thrive | edge `thrive-memory-tool` |
| `memory_recalled` | `{kind, key, found: bool}` | Thrive | edge |
| `memory_forgotten` | `{kind, key}` | Thrive | edge |

---

## 4. Naming rules

1. **snake_case**, present-tense verb at end (`credit_added`, not `add_credit` or `creditAdded`).
2. **Subject-first**: `credit_added`, not `added_credit`.
3. **No abbreviations** except `pdf`, `qr`, `ai`, `id`, `og`.
4. **No PII in event_name** (no email, no slug, no name). Put IDs in properties.
5. **Reserved suffixes**: `_started`, `_completed`, `_failed`, `_viewed`, `_clicked`, `_sent`, `_received`, `_created`, `_deleted`, `_updated`.
6. **Properties keys snake_case.** Values primitive or short string IDs only.
7. **One event per concept** — do not also fire a generic `feature_used` alongside.

---

## 5. Deprecation list (events/tables to retire after Phase 3)

| Today | Replace with |
|---|---|
| `profile_view_tracking.ts` writes | `passport_viewed` event |
| `share_link_views` table inserts | `studio_share_link_viewed` / `document_viewed_public` events |
| `opportunity_views` table inserts | `gig_opened` event |
| `deckMetrics.ts` localStorage | `document_*` events |
| Console-log "analytics" in edge fns | `analytics_events` inserts |
| Ad-hoc `analytics_events` rows w/o entry here | rejected by Zod validator |

---

## 6. Out of scope

- A/B test variant tracking — needs experiments table first.
- Revenue attribution chain — Phase 6.
- Server-side enrichment (IP→country, UA→device) — already handled by `site_analytics` collector; we'll join on `session_id`.
