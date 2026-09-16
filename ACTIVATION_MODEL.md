# Kretopia Activation Model v1.0
**Status:** Proposed · **Owner:** Growth + Data · **Date:** 2026-06-22 · **Phase:** 2 / Stabilize

---

## 1. Why we need a single activation definition

We currently have several implicit activation signals scattered across the product:

| Surface | Implicit "activated" signal |
|---|---|
| `profiles.verification_score` | Passport completion % |
| `daily_streaks` | Returned next day |
| `credits` count | Has any creative work |
| `connections` count | Has any network |
| `seed_new_user_experience` RPC | Onboarding completed |
| `analytics_events` ad-hoc | One-off feature pings |

No single column or event answers *"is this user activated?"* — which means retention, funnels and cohort math are unreliable.

This document defines **one** event, **one** SQL definition, and **one** dashboard tile.

---

## 2. The Activation Event

> **A user is Activated when, within 7 days of sign-up, they have completed all four of the following:**

| # | Signal | Source of truth | Threshold |
|---|---|---|---|
| 1 | **Claimed Passport** | `profiles.onboarding_completed_at IS NOT NULL` | true |
| 2 | **Added ≥ 1 Stamp (Credit)** | `credits.user_id = X AND credits.status != 'deleted'` | count ≥ 1 |
| 3 | **Made ≥ 1 Connection** *(any of)* | `connections` accepted **OR** `swipes` mutual match **OR** Studio invite accepted | count ≥ 1 |
| 4 | **Passport ≥ 60% strength** | `profiles.verification_score` (see [Profile Strength Indicator] memory) | ≥ 60 |

All four must be true. Anything less = **Onboarded but not Activated** (a separate stage we track for the funnel).

### Why these four

- **Claim** proves intent — they own the profile, not just a visitor.
- **Stamp** proves the platform has *their* data (the moat). One Stamp = ICDB graph node created.
- **Connection** proves the network effect fired — at least one edge in the graph.
- **60% strength** proves the Passport is presentable. Below this, recruiters bounce and the user is invisible in Discover (see [Discovery Quality Gates] memory).

### Why not include these

| Rejected signal | Reason |
|---|---|
| Posted a Gig | Confounded with `account_type='company'`; not a creator activation |
| Sent a Message | Easy to game; doesn't prove value received |
| Visited 4 surfaces in 24h (old recommendation) | Pageview ≠ value; we want *commitments*, not clicks |
| Connected payout | Pay is a power-user feature, not activation |
| Subscribed | Monetization ≠ activation; activation precedes monetization |

---

## 3. Persona-specific overrides

The base model fits **Creators (default `account_type`)**. Other personas need parallel definitions because their "value" surface differs:

| Persona | `account_type` | Activation override |
|---|---|---|
| **Creator** | `creator` (default) | Base model (4 signals above) |
| **Company / Brand** | `company` | Claim + posted 1 Gig + reviewed ≥ 1 applicant + Passport ≥ 40% |
| **Recruiter** *(uses Company UI today)* | `company` w/ `recruiter_mode=true` | Claim + saved ≥ 1 Shortlist + viewed ≥ 5 Passports + sent ≥ 1 outreach |
| **Community / Circle host** | `creator` w/ `is_circle_host=true` | Claim + created Circle + ≥ 3 members joined + 1 Sound Stage opened |

Recruiter and Community currently have **no `account_type` flag** — Phase 4 Passport work should add `profiles.persona` enum.

---

## 4. Time window

- **Activation window:** 7 days from `auth.users.created_at`.
- **Late activation:** 8–30 days → tracked separately as `late_activated`.
- **Never activated:** `created_at < now() - 30 days` AND signals incomplete.

Rationale: 7 days matches our weekly digest cadence and the [Onboarding Tour Separation] memory's drop-off curve.

---

## 5. Implementation

### 5.1 Single SQL view (source of truth)

```sql
-- supabase/migrations/<ts>_activation_model.sql
CREATE OR REPLACE VIEW public.user_activation_status AS
SELECT
  p.user_id,
  p.created_at AS signed_up_at,
  p.onboarding_completed_at IS NOT NULL                                AS claimed,
  COALESCE(c.credit_count, 0)                                          AS credit_count,
  COALESCE(cn.connection_count, 0)                                     AS connection_count,
  COALESCE(p.verification_score, 0)                                    AS passport_strength,
  (
    p.onboarding_completed_at IS NOT NULL
    AND COALESCE(c.credit_count, 0)         >= 1
    AND COALESCE(cn.connection_count, 0)    >= 1
    AND COALESCE(p.verification_score, 0)   >= 60
  )                                                                    AS is_activated,
  LEAST(
    p.onboarding_completed_at,
    (SELECT MIN(created_at) FROM credits      WHERE user_id = p.user_id),
    (SELECT MIN(created_at) FROM connections  WHERE (requester_id = p.user_id OR recipient_id = p.user_id) AND status = 'accepted')
  ) AS activated_at  -- max of the three commitments
FROM profiles p
LEFT JOIN (SELECT user_id, COUNT(*) AS credit_count FROM credits WHERE status != 'deleted' GROUP BY user_id) c ON c.user_id = p.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS connection_count FROM (
    SELECT requester_id AS user_id FROM connections WHERE status = 'accepted'
    UNION ALL
    SELECT recipient_id AS user_id FROM connections WHERE status = 'accepted'
  ) x GROUP BY user_id
) cn ON cn.user_id = p.user_id;

GRANT SELECT ON public.user_activation_status TO authenticated, service_role;
```

### 5.2 Fired event

When all four conditions flip true for the first time, a Postgres trigger inserts:

```json
{
  "event_name": "user_activated",
  "category": "Identity",
  "user_id": "...",
  "properties": {
    "days_to_activate": 3,
    "persona": "creator",
    "passport_strength_at_activation": 68,
    "first_credit_id": "...",
    "first_connection_id": "..."
  }
}
```

into `analytics_events` (see ANALYTICS_EVENT_TAXONOMY.md).

### 5.3 Dashboard tile

Single number on `/admin/analytics`:

```
Activation Rate (last 30d cohort) = activated_users / signed_up_users
```

Target: **≥ 35%** within 60 days (current estimate from spot-check: ~12%).

---

## 6. Open decisions for user approval

1. **60% threshold** — confirm or adjust (50 / 70?). Spot-check shows median completed-onboarding user sits at 48%.
2. **Connection counts Studio invite-accepted?** Recommended yes — it's a stronger commitment than a swipe.
3. **Add Circle membership as a 5th optional signal?** Recommended no — keep it 4. Circles are sunset/hidden per memory.
4. **Persona enum migration** — defer to Phase 4 (Passport v4) or do it now?

---

## 7. Out of scope (for this doc)

- Re-activation model (returning after 30d dormant) — Phase 5.
- Revenue activation (first paid invoice) — Phase 6 (ThrivePay analytics).
- Ambassador / Founding Member activation — already tracked via dedicated quest tables.
