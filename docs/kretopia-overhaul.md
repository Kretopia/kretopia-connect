# Kretopia overhaul: tracking (started 2026-10-21)

Source: the structured brief pasted by the owner. `Kretopia-Updates.md` is **not in the repository**, so the pasted brief is used and the original notes were not read. Branch `feat/kretopia-overhaul`, from `main` @ `1695bf539`. Nothing is pushed, deployed or migrated. Official commands: `npm run typecheck` (tsc on `tsconfig.app.json`), `npm run lint`, `npm test` (vitest), `npm run build`. Lint and 7 test files are already red on `main` (see `docs/platform/CI_POLICY.md`).

Standing project rules that apply (AGENTS.md and earlier owner decisions): Passport keeps one compact overview and reads Reach only from connected-platform syncs; `KretopiaQRCode` for Passport codes; shared header, `KretopiaSpinner`/`KretopiaLoader` for waits, no "% fit" shown anywhere (owner decision, Scout Wrapped), shared theme tokens, no fabricated metrics.

## Status by subject
| | Subject | Current state (inspected) | Status |
|---|---|---|---|
| H | Gigs button next to Marketplace | Cause found and verified in a browser: the active segment was a ghost glass button painted with `bg-primary`; `.btn-glass` forces its text colour with `!important` and that colour equals `--primary` (white in dark themes, near-black in light), so text and icon vanished (`rgb(255,255,255)` on `rgb(255,255,255)`; `rgb(15,15,18)` on `rgb(18,18,23)`). Fixed by `GigsViewToggle` using the glass `default`/`ghost` variants, no override. Test added. | **done** (slice 1) |
| A | Passport EPK / Website spacing | Reproduced at 320 px in the Passport share sheet (`components/passport/PassportShareSheet.tsx`): each target (Personal website, EPK / Media kit, Showreel, Passport profile...) carried 8 icon-only 32 px buttons that wrapped 6 + 2, with the same globe glyph for every target. Rebuilt: labelled Share and Copy link (40 px), the six other channels (WhatsApp, LinkedIn, X, Instagram, Email, QR) behind a "More ways to share" disclosure as labelled 56 px tiles, one glyph per target, real links via `Button asChild`, and `KretopiaQRCode` instead of the plain `qrcode.react` code (AGENTS.md rule). The owner tile row (`PassportSmartActions`, 5 tiles of 53 x 64 px at 320 px) and the owner overflow menu were measured and are not cramped (no clipped label, no overflow). The public hero already carries Connect / Message / Collaborate / Add to project / Book; the public Passport and the EPK are the same page (`/epk/:id` renders `PublicPassportHero`), and the owner's rule of no outbound link or personal-site link from the card is kept, so no extra "visit site" action was added. | **done** (slice 2, first part) |
| B | Stamps / projects in carousels | `embla-carousel-react` is already a dependency. Stamp model (`RoleStamp.tsx`, credits, co-signs) not yet read: the business definition comes first. | not started |
| C | Shareable retrospective | No Passport retrospective exists. Reusable: Scout Wrapped components, `html2canvas`, `ShareableProfileCard`, `PassportShareSheet`. Data actually available (stamps, co-signs, dates, visibility) to be listed before any card. | not started |
| D | EPK visual rework | `pages/CreatorEPK.tsx` (1,044 lines), `components/epk/*`. Already reworked as a Wrapped surface in PR #115; the remaining violet is to be located in a browser. | not started |
| E | Industry benchmark | No external benchmark done. A web tool exists in this session but no platform has been consulted; recorded as not done, to validate later. | not started |
| F | Company matching with evidence | `src/lib/matchScoring.ts`, `matchRanking.ts`, `matchReasons.ts`, `opportunityMatch.ts`, `intentMatching.ts` exist; one definition of "match" is to be kept. Audience data: only YouTube has a stored audience number (see the product backlog), so audience fit must read "audience data not provided" for the rest. | not started |
| G | Kreto finds the matches | Edge functions `ai-talent-match`, `discover-creators`, `generate-match-explanation`, `elevate-brief`, `extract-brief` exist (run in `kretopia-app`, deployed by hand). | not started |
| I | Project from a free-text prompt | `extract-brief`, `elevate-brief` and `StudioAICreate` exist; to be read before choosing the reuse. | not started |

## Decisions and hypotheses
- Decision: slice order follows the brief (quick fixes, Passport/EPK, carousels, retrospective, matching, Kreto, prompt, validation); H first because it is local and verified.
- Hypothesis: "EPK and Website too tight" is the owner tile row on small phones; to confirm visually before changing anything.
- Blocked: nothing yet. Anything that needs an edge function deploy stays a manual paste into `kretopia-app`.

## Slice 1: done
`src/components/opportunity/GigsViewToggle.tsx` (new), `src/pages/Opportunities.tsx` (uses it), `src/components/opportunity/__tests__/GigsViewToggle.test.tsx`. Checked: 3 unit tests, ESLint clean on the three files, browser check in the dark and light themes (before/after computed colours). Not run: full suite, build (this slice does not touch them).

## Slice 2 (Passport and EPK), part 1: done
`PassportShareSheet.tsx` rebuilt as above; `__tests__/PassportShareSheet.test.tsx` (6 tests; restoring main's file fails all 6). Checked: Passport suite 29 tests, ESLint clean on both files, `tsc -p tsconfig.app.json` exit 0, browser at 320 px (no horizontal overflow, no clipped label, every control 40 px or taller). Not run: full suite, build, dark theme screenshot, 390 and 768 px captures. Hypothesis kept: the owner meant these share options; if the meeting meant another screen, it is the owner tile row or the overflow menu, which were measured fine.
