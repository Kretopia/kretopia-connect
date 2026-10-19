# Kretopia loop metrics

The loop: **sign up, build a Passport, add credits, get them confirmed, get matched, connect, work together in a Studio, record and finish, collect confirmed credits.** This document defines what to count. It adds no analytics provider and no tracking code.

## Where events come from today
`trackEvent({ eventName, eventCategory, properties })` in `src/lib/analytics.ts` writes to `analytics_events` (about 1.4 M rows); page-level data is in `site_analytics`. Many loop events already exist as table rows, so they are counted from the table, not from a tracker.

## Events
| Event | Source today | Status |
|---|---|---|
| `signup` | `analytics_events` `sign_up` / `signup_success`; `profiles.created_at` | tracked; use `profiles` as truth |
| `profile_completed` | `analytics_events` `profile_completed`; `profiles.onboarding_completed` | tracked |
| `passport_created` | first Passport view or share: `passport_revealed`, `passport_shared` | partly tracked; define "created" with product |
| `credit_created` | `credits.created_at` | table |
| `credit_confirmed` | `credits` verification state (`classifyCreditEvidence`), `credit_endorsements`, `credit_ai_verifications.status` | table |
| `co_sign_accepted` | `credit_vouches`, accepted `credit_endorsements` | table |
| `match_viewed` | `profile_viewed` events (deck and grid) | partly tracked; no per-card view |
| `match_action_taken` | `swipes` rows; `analytics_events` `swipe` | tracked |
| `connection_requested` | `connections` rows | table |
| `connection_accepted` | `connections` accepted state | table |
| `studio_created` | `projects.created_at`; `analytics_events` `project_created` | tracked |
| `recording_saved` | `call_transcripts` rows with a `recording_id` | table |
| `project_completed` | `projects` completion state (confirm the column before building the metric) | to confirm |
| `opportunity_applied` | `applications` rows; `analytics_events` `applied` | tracked |

Properties allowed: ids, counts, enums, durations. Never message text, transcript text, emails, or tokens.

## Core metrics
| Metric | Definition |
|---|---|
| Activation | Share of new accounts that, within 7 days, complete the profile **and** create a credit or send a connection request. |
| Retention | D7 and D30: share of a signup cohort with at least one of `match_action_taken`, `studio_created`, `credit_created`, a message sent. |
| Verified credits | Confirmed credits divided by created credits; and confirmed credits per active member per month. |
| Collaborations completed | `project_completed` with two or more accepted members, per month. |
| Match acceptance | `connection_accepted` divided by `connection_requested`; and mutual connections per 100 `match_action_taken`. |
| Recording success | Of calls that started a recording: stored (`call_transcripts` row), recap ready, recap skipped (`error` starts `transcript_skipped:`), failed (other `failed`). Report all four, not one rate. |
| Webhook success | Per provider (Daily, Stripe, Telegram, email suppression): 2xx divided by deliveries, plus rows processed through the ledger. Source: function logs and `GRAFANA_SUPABASE_PLAN.md`. |

## Rules
- A metric is computed from a real table or event, or it is not reported.
- Exclude bots, previews, and admin routes (`platformAnalytics.ts` already filters them for page data); exclude imported (unclaimed) profiles.
- Report cohorts with their size. Under 30 users, show the count, not a rate.
- Review weekly; one owner per metric.

## Gaps to close (no code in this change)
Per-card `match_viewed`; a clear `passport_created` definition; the `projects` completion field; a recording-requested event so "recording started but nothing stored" can be measured.
