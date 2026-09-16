# Public Passport Route Fix Report

## Scope

The approved minimal fix for `CreatorEPK.tsx` (the component behind `/epk/:userId`, the canonical public Passport route, and also what `ViewProfile.tsx` renders inline for signed-out visitors at `/profile/:userId`). Root cause and full route/data-contract tracing already documented in `PASSPORT_AND_CONVERSION_AUDIT.md` §2–§3 — not repeated here in full.

## Root cause (confirmed, not repeated in depth — see audit §2)

`CreatorEPK.tsx` queried `.from('profiles')` directly on a comment's now-false assumption ("RLS allows public read"). Migration `20260502224404_d273510f-ca92-46e7-8954-030ab40c3cae.sql` deliberately dropped the blanket-true SELECT policy on `profiles` as a security hardening; the page was never updated. Every non-owner visitor got zero rows back (RLS-filtered, no error) → `Profile Not Found`.

## What changed

`src/pages/CreatorEPK.tsx`, one query (lines ~156-179):
- `.from('profiles')` → `.from('public_profiles_safe')` — the existing, already-`GRANT SELECT ... TO anon`-ed safe view (`supabase/migrations/20260803091710_...`), the same one `HandleResolver.tsx` and `Circle.tsx`'s Browse tab already use correctly.
- SELECT column list trimmed to the view's actual columns: `user_id, full_name, role, bio, location, avatar_url, linkedin_url, instagram_url, twitter_url, youtube_url, spotify_url, behance_url, imdb_url, soundcloud_url, verification_tier, verification_status, professional_skills, cover_image_url`.
- The stale comment was replaced with one explaining why (pointing at the migration and this report) so a future reader doesn't reintroduce the same false assumption.

No RLS policy was touched. No new grant was added. The fix is entirely a query-target change on the frontend, per the audit's explicit instruction not to weaken RLS to make a query work.

## What is temporarily absent from the public EPK as a direct, accepted consequence

`public_profiles_safe` does not (yet) carry every column `CreatorEPK` used to request. Every one of the following was confirmed, by reading each call site before making this change, to already be optional-chained or conditionally rendered — none of them can crash the page, they simply stop appearing:

**Functional, not just decorative** — flagging these separately because they're not cosmetic:
- `is_claimed` — the unclaimed-profile claim banner (`profile.is_claimed === false` checks at lines 567, 588, 988) will not appear for anyone, even genuinely unclaimed profiles, since `undefined === false` is `false`. This removes a real claim-funnel entry point from the public page until fixed.
- `website`, `calendly_url` — the "Visit website" / "Book a call" buttons (`handleVisitWebsite`, `handleBookCall`) no longer have anything to link to.
- `collab_intent`, `rate_range` — the "what they're looking for / rate" row (lines 656-673) disappears entirely.

**Cosmetic / lower-impact**:
- `average_rating`, `total_reviews` — star rating hidden.
- `achievement_badges` — badge row hidden.
- `passion_skills` — passion-skill chips hidden (`professional_skills` is unaffected — it's already in the safe view).
- `icdb_creator_id` — the verified-ID chip hidden.
- `job_title` — falls back to `profile.role` (already had that fallback: `profile.job_title || profile.role || 'Creator'`), effectively invisible.
- `sub_roles`, `model_stats`, `mother_agency`, `model_unions`, `model_categories` — the entire "Model strip" section hidden for model-profession profiles specifically.

**Recommendation, not yet actioned**: extending `get_public_profiles_safe()` with at minimum `is_claimed` (a simple boolean, unambiguously safe to expose — it's the entire premise of the public claim-funnel CTA) should be the first candidate for a fast-follow migration, ahead of the purely cosmetic fields. This needs your explicit approval before I write or apply it, per the standing migration-approval requirement.

## Verified live

- `/epk/4b565cca-3389-4488-9b09-114bf894ad84` (a real, existing profile): renders correctly — name, role, location, avatar, "VERIFIED CREATIVE PASSPORT" badge, professional skills chips, Kretopia Credits (6 verified, real entries), Press/Featured In links, Awards — all real data, confirmed via full page-text extraction, not just a screenshot glance.
- `/epk/00000000-0000-0000-0000-000000000000` (a genuinely nonexistent id): still correctly renders "Profile Not Found" — confirms the legitimate not-found path is unaffected by this change.
- Desktop 1440×900 and mobile 390×844: both confirmed, zero horizontal overflow at mobile.
- Console: only pre-existing sandbox noise (WebSocket/realtime connection failures, 404s — the same class of noise observed on every page tested in this sandbox all session, unrelated to this component).

## Not in scope for this fix (flagged in the audit, not yet approved)

- `ViewProfile.tsx`'s owner-self-redirect bug (an owner previewing their own profile via the "Preview public Passport ↗" link gets bounced straight back to `/profile` instead of seeing the visitor view) — audit §2, second bug.
- The duplicate `/dashboard` route (`App.tsx:339` shadowing the intended `/desk` redirect at `App.tsx:538`) — audit §2, third bug, directly behind the "Private dashboard →" CTA.
- HoloCard CTA integration, private dashboard redesign, Landing analytics, admin funnel — all separate phases per the original task, none approved yet.

## Regression gate

- typecheck: PASS
- lint: PASS (22 pre-existing `no-explicit-any` findings elsewhere in this file, confirmed via diff to be nowhere near the changed lines)
- build: PASS
- tests: PASS (127/127)

## Status

`PUBLIC_PASSPORT_FIX_IMPLEMENTED` — `BROWSER_VERIFIED` for the two scenarios above (valid profile, unknown profile) at desktop and mobile. Not `PRODUCTION_VERIFIED` (no production access in this session). The owner-preview self-redirect bug and the field-gap fast-follow migration remain open, pending your decision (per `PASSPORT_AND_CONVERSION_AUDIT.md` §17).
