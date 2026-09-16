# Landing Hero — Avatar Asset & Hero Audit (Verified Creative Constellation)

## Status: `AUDITED` — no code has been edited. This document only.

## 0. Safety and scope check

```
git status -> only supabase/functions/mcp/index.ts modified (pre-existing, unrelated,
              left untouched all session)
git diff / git diff --staged -> empty (aside from the above)
```

No stashes, resets, or destructive operations were used to reach this state. `LANDING_HERO_RELEASE_GATE.md` (the prior task's final report) is committed and pushed as [PR #91](https://github.com/thrivein-app/thrivein-new-beta/pull/91) — this task starts from that clean baseline.

## 1. Asset audit — the core question this brief asks first

**Finding: there is no backend mechanism to identify a real user who has consented to marketing display.** Searched `src/integrations/supabase/types.ts` for any `marketing_consent`, `public_marketing`, `show_on_landing`, `featured_on_landing`, or equivalent column — none exists on `profiles` or anywhere else in the schema. This isn't a policy judgment call; it's a hard data-availability fact. **No real production user's avatar can be used, full stop — there is no field to even query for consent, let alone a review/approval workflow behind one.**

| Asset | Exact path/source | Owner/consent status | Public marketing safe? | Current usage | Chosen? |
|---|---|---|---|---|---|
| `avatar-silhouette.svg` | `public/avatar-silhouette.svg` (root URL `/avatar-silhouette.svg`) and a bundled copy at `src/assets/avatar-silhouette.svg` | Team-owned, generic illustrated silhouette (gradient-filled person glyph, `#E8EBFF`→`#C7CEFF`), no real person depicted | **Yes** — already shipped app-wide as the anonymous-user fallback | Live today in `PassportHero.tsx`, `CreditsIdentityPanel.tsx`, `SpeedHostCockpit.tsx`, `SpeedActionRail.tsx` as the `<FramedAvatar>` fallback when `profile.avatar_url` is empty | **Yes** — this is category C ("static anonymized demo assets already in the repository") exactly as described in this brief's §1 |
| `kreto-avatar.png` | `src/assets/kreto-avatar.png` | Team-owned, Kreto's own brand-character portrait (used by `KretoAvatar.tsx`) | Technically safe (not a real person) | Live today, but represents *Kreto specifically*, not a generic creator | **No** — using a single named brand character repeatedly to stand in for "the community of creators" would misrepresent what the nodes mean, closer to a fabricated-persona problem than a privacy one. Reserved for its existing role. |
| `KretoMark` (official K-mark) | `src/assets/brand/kretopia-k-mark.png.asset.json`, via `src/components/brand/KretoMark.tsx` | Official brand mark, already used decoratively in the current Signal Field | Yes | Already placed in the hero (low-opacity, `variant="bare"`) as of the prior pass | Retained as the one non-avatar "signal" node in the constellation, not duplicated as a stand-in for a person |
| Any real `profiles.avatar_url` | Supabase Storage, per-user | Belongs to individual users; no consent/marketing-approval field exists to check | **No** — cannot be verified safe by any means available in this codebase | N/A for this purpose | **Not used, per this brief's own §1 requirement** |
| Team-owned demo Passport / approved marketing creator assets (brief's categories A/B) | — | — | — | Searched `src/assets/`, `src/assets/brand/`, and grepped for `demo-passport`, `demo-avatar`, `marketing-asset`, `sample-profile` conventions — **none exist in this repository** | Not available — flagged below |

## 2. Missing-asset dependency (documented, not invented around)

Categories A ("existing team-owned demo Passport assets") and B ("explicitly approved marketing creator assets") from this brief's §1 **do not exist in this repository today**. Only category C (`avatar-silhouette.svg`) is available. This audit does not invent a substitute identity or fabricate a "demo creator" persona to fill that gap — per this brief's own instruction ("do not invent user identities"), the constellation will be built entirely from the one approved anonymized asset plus the existing KretoMark, not from any depiction of a specific (real or invented) person.

## 3. Hero audit — where nodes can safely sit today

Current hero layout (post `LANDING_HERO_RELEASE_GATE.md`, [PR #91](https://github.com/thrivein-app/thrivein-new-beta/pull/91)):

- Content column: `max-w-[900px]`, horizontally centered, containing eyebrow → H1 (2 lines) → supporting line → body paragraph → CTA pair → microcopy. At 1440px this column occupies roughly the center 900px with the full-bleed hero being 1440px wide — **meaning roughly 270px of clear space exists on each side at desktop width**, which is exactly where peripheral nodes belong per this brief's own "must live at the Hero edges" requirement.
- At 768px and below, the content column effectively fills the full available width (minus padding) — **there is little to no true "edge" space left at tablet/mobile widths**, which is why this brief's own §2 caps mobile at 2 nodes (or 1 + K-mark) rather than the desktop's 5, and explicitly forbids any absolutely-positioned node over the headline/CTA. This constraint is real, not just cautious — confirmed by measuring the actual column-to-viewport ratio at each breakpoint, not assumed.
- Current decorative background z-order (back to front): vignette → Signal Field radial → KretoMark (top-center, low opacity) → coordinate grid → content. Nodes would slot in as siblings to the Signal Field/KretoMark layers, still behind the content column, still `pointer-events-none`, still `aria-hidden` by default.
- The Signal Field's pointer-driven offset (`fieldX`/`fieldY`, capped ±24px/±14px) is the only existing motion to coordinate with — this brief's own "optional subtle local parallax only on desktop, capped movement" requirement can reuse the same spring-based pattern already in place rather than inventing a second motion system.

## 4. Implementation plan (not yet executed)

1. Desktop: up to 5 small (`40-88px`) framed silhouette nodes positioned at the hero's genuine edge margins (outside the `max-w-[900px]` content column), asymmetric placement, each behind a subtle graphite ring frame (reusing the existing `border-card`/`shadow-lg` framing convention from `FramedAvatar` usage elsewhere, adapted to a graphite tone rather than the app's default card border).
2. Mobile (≤640px): reduce to 2 nodes or 1 node + the existing KretoMark, none absolutely positioned over the headline or CTA row — verified against the real column-width measurement in §3, not assumed safe.
3. Thin, low-opacity connecting lines between nodes and/or toward the existing Signal Field center — reusing an SVG line approach, capped opacity, no moving particle stream, no animation beyond an optional slow opacity drift.
4. All nodes and lines: `aria-hidden="true"`, `pointer-events-none`, no `onClick`, no route — purely decorative per this brief's default interaction model. The optional "See a Creative Passport" text CTA (§3 of this brief) is **not implemented in this pass** — it requires an approved public demo profile to link to, which does not exist per §1/§2 of this audit; implementing it now would mean linking to a real user's profile without the consent verification this brief itself requires. Flagged as `REQUIRES_APPROVED_ASSETS`, not built around.
5. Motion: translation-only float (max 6-10px, 9-16s, ease-in-out, staggered phase per node), reusing the existing `useReducedMotion()` gate already wired into this file — disabled entirely under reduced motion, exactly like the current Signal Field.
6. Desktop-only subtle parallax reuses the existing `pointerX`/`pointerY` spring values already computed for the Signal Field (no new pointer-tracking system) — capped, and explicitly not applied on touch (no `mousemove` fires on touch devices, so this is naturally satisfied, but will be double-checked rather than assumed).

## 5. Files to change vs. protect (same boundary as the prior Signal Field task)

**May change:** `src/components/landing/KretopiaHero.tsx` only, plus a new focused test extension in `src/components/landing/__tests__/KretopiaHero.test.tsx`.

**Protected, unchanged by this task:** everything listed in the prior audit's §10 (Navbar, other Landing sections, analytics libs, brand components read-only, all routes/auth/RLS/payments/backend), plus explicitly: no `profiles` table query of any kind, no Supabase Storage read for user avatars, no new consent/marketing-flag column (that would be `REQUIRES_BACKEND_WORK`, out of this task entirely).

## Summary of flags requiring a decision before or during implementation

- **Categories A/B assets don't exist** — the constellation will ship with silhouette + K-mark nodes only. If real approved creator/demo assets become available later, swapping them in is a follow-up, not blocked by this pass.
- **The optional "See a Creative Passport" CTA is deferred** (`REQUIRES_APPROVED_ASSETS`) — no approved public demo profile exists to link to.
- **Mobile node count is genuinely constrained by layout**, not just this brief's own cap — confirmed via measurement, not assumed.

`HERO_CONSTELLATION_AUDIT_COMPLETE`
