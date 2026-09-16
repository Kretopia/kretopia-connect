# Kreto Character Asset Report

## Status: `AUDITED` (rights), `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` (Landing Hero) / `UNIT_TESTED` only (New Room — see limitation)

## Rights update — supersedes the prior `UNKNOWN_RIGHTS_ORIGIN` classification

Every earlier report this engagement (`KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md`, `KRETO_ORIGINALITY_AND_REFERENCE_REPORT.md`, `KRETO_HERO_AND_NEW_ROOM_REFERENCE_REPORT.md`) classified the "Meet Kreto" reference image as `UNKNOWN_RIGHTS_ORIGIN`, based on the available evidence at the time (a WhatsApp-forwarded file with no ownership/license metadata in the repo). Asked directly this pass, the user confirmed Kretopia owns this artwork outright. That confirmation is the basis for everything below — it reverses the prior classification for this specific image, it does not change how any *other* unconfirmed reference should be treated in the future.

## What was built

Five real crops from the source artwork (`~/Desktop/KRETOPIA/WhatsApp Image 2026-09-06 at 18.44.57.jpeg`, 1254×1254), saved as checked-in JPEGs (`src/assets/brand/kreto/`, ~136 KB total for all five):

- `kreto-main.jpg` (645×830) — the full-body character.
- `kreto-scout.jpg`, `kreto-connector.jpg`, `kreto-producer.jpg`, `kreto-publicist.jpg` (240×240 each) — the four role variants, already framed as rounded-square tiles in the source art.

These are real, standard Vite-bundled local assets (`import x from "@/assets/brand/kreto/....jpg"`), not routed through the Lovable CDN asset-proxy pattern `KretoMark` uses (`kretopia-k-mark.png.asset.json`) — that pattern requires an `asset_id` minted by Lovable's own upload tooling, which isn't available from here, and (per multiple prior reports this engagement) doesn't even resolve locally. Standard Vite imports work in every environment and avoid that whole class of problem.

`KretoCharacter.tsx` (new component) renders these real images with the same honesty rules as `KretoPresence`: decorative (`aria-hidden`) by default, every non-idle/attentive state paired with real `sr-only` text, `useReducedMotion()`-gated idle float, no state invented internally. It cannot express different facial expressions per state (there is exactly one pose per variant) — state is layered on top instead, as a small colored signal-dot badge, same accent-dot visual language `KretoPresence` already uses.

## Where it's live

- **Landing Hero** (`KretopiaHero.tsx`): all five variants now appear in the first section, replacing the single abstract `KretoPresence` badge — Scout/Connector/Producer top corners, Publicist stacked above the large main character bottom-right. All five are `pointer-events-none`, `hidden lg:block`, and positioned outside the centered `max-w-[900px]` text column — the headline and CTA pair are unobstructed and unchanged. `variant="main"` gets a soft `mask-image` radial fade so its photographic rectangle blends into the page's dark background instead of reading as a pasted sticker; the four role tiles keep their natural rounded-square edge, matching how they're already framed in the source art.
- **New Room** (`VoiceFirstCreateModal.tsx`): every prior `KretoPresence` instance (prompt/recording/thinking/error/review) now renders `KretoCharacter variant="main"` instead, carrying the exact same real state mapping built in the previous pass (`KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md`) — only the visual changed, not any trigger logic.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npx eslint` — clean (the 7 pre-existing `any` findings in `VoiceFirstCreateModal.tsx` predate this change, confirmed via `git diff`).
- `npx vitest run` — 185 tests, 179 passing; the one failing file (`UnifiedSearchDropdown.hero.test.tsx`) fails identically on `HEAD` before this change (confirmed via `git stash`), unrelated. New: 5/5 in `KretoCharacter.test.tsx`; `VoiceFirstCreateModal.test.tsx`'s 19 tests (from the prior pass) all still pass unmodified after re-pointing their `KretoPresence` mock to `KretoCharacter`.
- `npm run build` — clean; the five images bundle as separate content-hashed static assets (`kreto-main-*.jpg` 83 KB, the four role tiles ~13 KB each) — negligible weight, no new dependency.
- **Live-verified, Landing Hero, real fresh page load**: all five characters render correctly at desktop width with zero console errors; correctly hidden below the `lg` breakpoint (no overlap risk on tablet/mobile, matching the existing `LANDING_HERO_AVATAR_ASSET_AUDIT.md` finding that no safe peripheral space exists below that width); headline and CTAs remain fully dominant and unobstructed.
- **New Room**: not live-verified this pass — the authenticated session available earlier in this engagement was not available in this pass's fresh browser tab, and no credentials exist to sign back in. Correctness here rests on the unit-test suite (state-mapping logic unchanged from the already-verified prior pass, only the rendering target swapped) rather than a live click-through. Flagged rather than assumed.

## What's next (per the user's own sequencing: Hero, then New Room, then "les autres")

Every other Kreto surface (Scout, Passport, Events, Circle, the Studio `KretoTip`) still renders the abstract `KretoPresence`/`KretoMark`, not this real character — consistent with the established "one surface at a time" rollout discipline. Rolling the real character out further is a natural next step, not done in this pass.
