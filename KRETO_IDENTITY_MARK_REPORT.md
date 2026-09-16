# Kreto Identity Mark — Migration Report

Covers the Kreto-identity portion of the Kreto/Stage/Recordings/Landing sprint.
Stage, Recordings, and Landing conversion remain per the Phase 1 audit
(`KRETO_STAGE_RECORDINGS_CONVERSION_AUDIT.md`) and are not covered here.

## What was built

`src/components/brand/KretoMark.tsx` — new, reusable compact identity mark.
Renders the real Kretopia K-mark asset (`kretopia-k-mark.png`, the same asset
`BrandLogo.tsx` already uses in the navbar/footer/auth — not a redrawn or
approximated logo), recolored per-surface via CSS `mask-image` rather than
guessing at the source PNG's native color, so it reads correctly on any
background (solid chip fill, dark card, muted surface) without a separate
asset per context.

**Variants:** `default` (elevated dark surface, ring), `compact` (solid
energy-pink fill, white mark — matches the existing chat-composer chip
convention), `interactive` (renders as a real `<button>`, requires an
accessible `label`), `muted` (low-opacity, no chrome), `status` (same chrome
as `default`, the canonical choice for loading/progress contexts).

**Sizes:** `xs` (24px) through `xl` (80px) — `xl` added specifically for the
one hero-modal placement (`VoiceFirstCreateModal`) that previously used a
256px full portrait; still far more restrained than the original per the
sprint's "not a massive circle" rule, while keeping real visual presence in
that one prominent moment.

**Activity states:** `idle` (default, static, no pulse — never invented),
`active` ("Kreto is working on this"), `pending` ("Kreto is waiting on you"),
and a distinct `recording` (red pulse, "Kreto is recording") preserved
specifically because `KretoAvatar`'s own prior code comments documented it as
a deliberate, safety-relevant "your mic is live" cue, not a branding choice —
collapsing it into the generic `active` state would have silently dropped
that signal.

## Original avatar usages → migrated

All 9 `KretoAvatar`-consuming files, 11 call sites total, now render
`KretoMark`. `KretoAvatar.tsx` itself is untouched (kept for the one deliberate
non-Kreto exception below) but has zero remaining consumers.

| File | Context | State mapping |
|---|---|---|
| `KretoTip.tsx` (9 surfaces: Today, Scout×2, Match, Events, Recordings, KrePay, Clients) | whisper card | idle |
| `ScoutedGigsSection.tsx` (×3) | scan/draft buttons + status card | active |
| `ThrivePromptHero.tsx` | busy indicator | active |
| `MeetKretoSection.tsx` (Landing) | brand card | idle |
| `ThriveAgentFab.tsx` (×4) | live chat drawer | thinking/speaking→active, listening→pending, recording→recording (preserved) |
| `AuthBrandingPanel.tsx` | auth whisper card | idle |
| `KretoPassportBuilder.tsx` | passport-building screen | active (real work in progress, paired with existing per-step `StageRow` detail) |
| `PassportKretoEntry.tsx` | passport entry card | idle |
| `VoiceFirstCreateModal.tsx` | creation modal hero | active, size `xl` |
| `TalentFinder.tsx` | search loading state | active |

Every migration was checked against its surrounding UI first (via a dedicated
research pass) to confirm the state signal was either redundant with existing
adjacent text/UI, or — in the one `recording` case — genuinely load-bearing
and worth preserving rather than simplifying away.

## Non-migrated user-avatar locations

None touched, and none needed touching. Real people's profile pictures use
shadcn/Radix `Avatar` (`src/components/ui/avatar.tsx`, 183 files) — entirely
separate markup, imports, and styling from `KretoAvatar`/`KretoMark`. Confirmed
zero overlap during the Phase 1 audit before any edit was made.

## Deliberate exception, unchanged

Studio's `KretoTip` branch (`WorkHome.tsx` surface) keeps its own inline
Sparkles-in-circle chip instead of `KretoMark` — this was an explicit,
user-directed decision from earlier in this session (remove the avatar from
the Studio card specifically), independent of this identity-system work. Only
its code comment's justification was corrected (it had inaccurately claimed
`StudioCreateHero` renders a full avatar elsewhere on the page — it doesn't).

## Accessibility

- Decorative marks are `aria-hidden`; a mark given an explicit `label` gets
  `role="img" aria-label`; the `interactive` variant is a real `<button>`
  with a required accessible name.
- A real accessibility bug was found and fixed in `KretoMark` itself before
  it could propagate to more than one call site: the `sr-only` state
  announcement was originally nested inside the decorative `aria-hidden`
  wrapper, meaning it was unreachable to screen readers whenever the mark had
  no explicit `label` — the common case for every one of the 11 migrated
  sites. Fixed by rendering the announcement as a sibling (Tailwind's
  `sr-only` is `position: absolute`, so this has zero effect on layout)
  rather than a descendant of the hidden wrapper.
- No color-only signaling: every non-idle state carries its `sr-only` text
  regardless of the pulse color/motion.

## Motion

The pulse uses Tailwind's `motion-safe:animate-pulse`, which is a native
`prefers-reduced-motion` media-query gate — no JS wiring needed per call site.
This incidentally fixes a real gap flagged in the Phase 1 audit: two
`KretoAvatar` callers (`ScoutedGigsSection.tsx`, `VoiceFirstCreateModal.tsx`)
already called `useReducedMotion()` for other elements on the same page but
never passed it into their avatar calls — that gap doesn't exist for
`KretoMark`, since the CSS-level gate applies unconditionally.

## Responsive behavior

Sizes are fixed Tailwind box classes (`h-N w-N`), consistent with the
existing `KretoAvatar` sizing approach — no separate responsive/breakpoint
logic was added or removed; callers pick a size per context exactly as before.

## Beyond the avatar: AI-labeling sweep

While migrating these files, found and fixed 8 additional live instances of
Kreto being described as "AI" — none limited to the avatar's own `alt` text
(already fixed as this sprint's opening action):

- `src/lib/brandLexicon.ts` — the project's own canonical "Brand Bible."
  `agentRole`/`agentTagline` baked "AI Executive Producer" directly into the
  constants meant to be the single source of truth for UI copy, while the
  same file's `KRETO_VOICE.banned` list two sections below explicitly bans
  "AI-powered"/"AI assistant" for Kreto's own voice. Fixed the constants to
  match the file's own stated rule.
- `src/pages/KretoTab.tsx` — the `/kreto` page's own header `eyebrow` prop.
- `src/components/auth/AuthBrandingPanel.tsx` — user-facing Auth-screen copy.
- `src/components/passport/PassportKretoEntry.tsx` — "Your AI Career
  Assistant" (hit two banned terms at once: "AI" and "Assistant").
- `src/components/home/UnifiedHome.tsx` + `src/components/SEO.tsx` — the
  Landing page's and the site-wide default SEO meta descriptions.
- **`index.html` (4 instances)** — the highest-visibility of all, since this
  static file is what search engines index and what social-link unfurling
  reads directly, never executing the client-rendered `SEO.tsx` component:
  the plain `<meta name="description">`, the `<meta name="keywords">` list
  (which literally had "AI Executive Producer" as a keyword term), and two
  separate `application/ld+json` structured-data blocks. All three JSON-LD
  blocks verified to still parse as valid JSON after the edits.

## Verification

- `npm run build` / `npm run test` (127/127) clean throughout.
- No new `npm run typecheck` errors introduced (pre-existing unrelated SEPA
  types-drift, flagged in the Phase 1 audit, is untouched by this work).
- Live-verified in the browser: the `alt` text fix, the meta description fix
  (re-checked after the `index.html` edit specifically, since that needs a
  hard reload rather than HMR), and `KretoMark`'s correct mount/sizing/DOM
  structure in the KretoTip card.
- One honest limitation, unresolved: the K-mark asset itself renders as an
  empty circle in this specific local dev preview — the asset URL returns
  200 but decodes to 0×0 (a CDN/asset-proxy quirk in this sandboxed
  environment, confirmed to affect the pre-existing `BrandLogo` navbar mark
  equally, not something this work introduced). The mount point, sizing, and
  DOM structure are all verified correct; the actual art needs a look in the
  real deployed environment.

---

Stage, Recordings, and Landing conversion are next per the audit's ordering.
