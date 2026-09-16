# Conversion diagnosis — last 7 days

## What the data actually says

Measured from `analytics_events` and `profiles` (Aug 24–31, 2026):

```text
Landing (/)          282 unique visitors
  ↓ 18%
Auth page (/auth)     51 unique visitors
  ↓ 33%
Sign-in attempts      17
  ↓
New accounts           1     (previous 7 days: 2)
```

Traffic is almost entirely direct (257 of 282). Instagram sent 6, Facebook 3, Google
1. So there is no meaningful paid or organic acquisition running right now — the
top of the funnel is tiny, and one extra signup either way swings the whole rate.

## Is it the copy?

**Unknown, and that is the real finding.** The landing components
(`KretopiaHero`, `BottomCTASection`, `StickyMobileCTA`, pricing, FAQ, all of
`src/components/landing/`) contain **zero tracking calls**. In seven days the whole
platform logged 3 `cta_click` events and no `sign_up` event at all. There is no
scroll-depth, no section-view, no per-CTA attribution.

That means nobody can currently tell the difference between "the copy doesn't
land", "the CTA is below the fold", "the auth screen scares people off", and
"only 282 people showed up". Rewriting copy now would be a guess with no way to
tell whether it worked.

Two things the data *does* support without new instrumentation:

1. **82% of landing visitors never reach `/auth`.** That is the single biggest
   leak, and it is upstream of any auth-screen problem.
2. **Only ~1 in 51 auth-page visitors completes an account.** Sign-in attempts
   (17) massively outnumber new accounts (1), which suggests `/auth` is being
   used mostly by returning users, and new-visitor signup is effectively stalled.

## Plan

### Step 1 — Instrument the landing funnel (prerequisite for any copy call)
Add a small `trackLanding()` helper wrapping the existing `analytics_events`
insert, and fire:
- `landing_section_viewed` (IntersectionObserver, once per section) for hero,
  proof, product sections, pricing, FAQ, bottom CTA
- `cta_click` with `{ cta_id, section, label, variant }` on every landing CTA
  including `StickyMobileCTA`
- `landing_scroll_depth` at 25/50/75/100%
- `signup_attempt` / `signup_success` / `signup_error` on the auth form, so the
  auth step stops being a black box

### Step 2 — Build a funnel view for these events
A `get_landing_funnel` SQL function plus a "Landing Funnel" panel in the existing
admin analytics area: visitors → section reached → CTA clicked → auth page →
signup attempt → account created, with per-CTA and per-section breakdown.

### Step 3 — Fix the two leaks we can already see
- **Landing → auth:** make the primary action reachable without scrolling and
  repeat it after the first proof section; make sure the sticky mobile CTA is
  actually mounted on the current landing route.
- **Auth screen:** default new visitors to the signup tab (currently they land on
  a combined screen where sign-in dominates), and lead with the single lowest-
  friction option rather than a form.

### Step 4 — Only then, test copy
Once steps 1–3 are live and collecting, run one hero-copy variant against
control via the existing `useLandingVariant` hook and read the result off the
funnel panel. Two weeks minimum at current traffic.

## Honest caveat on traffic volume

At 282 landing visitors a week, even a perfect funnel produces single-digit
signups. Instrumentation tells you *where* people fall out; it will not create
demand. Acquisition (Instagram sent 6 people all week) is the parallel problem
and is outside this plan's scope.

## Technical notes
- Reuses `analytics_events` (anon insert already allowed, admin-only read) via a
  helper modelled on `src/lib/deckMetrics.ts`.
- No schema change needed; `event_properties` jsonb carries `cta_id`/`section`.
- Admin panel follows the existing `CreativeActionFunnels.tsx` pattern.
