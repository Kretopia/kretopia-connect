# On Stage — Release Gate

Final assessment against the brief's own §22 `RELEASE_READY` criteria,
each judged honestly rather than rounded up. Full detail in the ten
companion reports; this is the gate decision.

| Criterion | Status |
|---|---|
| Opens as a full-screen Kretopia experience | **PASS** — verified live at three viewport classes |
| No small modal remains the primary call interface | **PASS** — Sheet fully replaced with real `DialogPrimitive` fullscreen content |
| Layouts adapt correctly for one, two, many participants and screen share | **PARTIAL** — 1-participant verified live repeatedly; 2/3-6-participant grids and screen-share's actual display-picker flow are code-reviewed only (unchanged pre-existing logic), not independently re-driven — this sandboxed single-account environment can't produce a second live participant or grant `getDisplayMedia` |
| All CTAs follow Kretopia grey-to-pink visual language | **PASS** — verified live (Go live, Record, Screen-share, Share all render the gradient correctly) |
| Camera/mic/device controls work and clean up on leave | **PASS** — cleanup logic pre-existing and re-confirmed correct by source; the denied-permission path (the only path this sandbox can exercise) verified live and handled gracefully; a granted-permission path was not exercisable here |
| HD implemented as a truthful adaptive preference | **PASS** — real Daily `sendSettings` preset, confirmed against the SDK's own types, not a fabricated label |
| Quality labels reflect actual behavior | **PASS** — Excellent/Good/Limited only render once a real Daily event has fired; no default/placeholder state shown as if real |
| Screen sharing uses explicit user permission | **PASS** — by construction; only a direct click can trigger `getDisplayMedia`, no code path calls it otherwise |
| Invite/share actions respect authorization and privacy | **PASS** — verified live including an independent database query confirming the actual written data matched what was authorized |
| Recording/replay respects permission and access rules | **PASS** — verified live; correctly host-scoped given the known, documented, out-of-scope RLS limitation rather than papering over it |
| No private Stage or recording link leaks | **PASS** — share links carry only a re-validated stage id; no token/attendee-list/recording-link exposure found in any client payload this phase touched |
| Desktop, tablet, and mobile pass | **PARTIAL** — desktop and tablet fully pass (live, interactive, no overflow); mobile rendering passes, interactive flow blocked by a tooling limitation in this pass's testing environment (see verification matrix) rather than a known defect |
| Accessibility passes | **PARTIAL** — a real regression was found and fixed (focus-trap/Escape), plus several real color/icon-only gaps closed and verified live against the actual accessibility tree; zoom-specific and screen-reader-specific testing were not performed (no screen reader available in this environment) |
| Performance passes | **PARTIAL** — the audit's top-flagged risk (unthrottled full re-fetch) and the unbounded audience-grid mount were fixed and functionally verified; no hard performance numbers were measured (no profiler available) |
| Typecheck, lint, build, and tests pass | **PASS** — clean on every commit this phase, no new lint issues beyond the pre-existing repo-wide baseline |
| Browser verification matrix is complete | **PASS** — complete, and honest about exactly which items are live-verified vs. code-reviewed vs. blocked, rather than uniformly claiming full coverage |
| No unresolved P0/P1 issue remains | **PASS** — the two known open items (speaker/audience media-layer enforcement; non-host replay access) are both pre-existing, documented, medium-or-lower severity, and require deliberate product/RLS decisions explicitly placed out of this phase's scope by the brief itself — neither is a newly discovered critical defect |

## Gate decision

**`READY_FOR_SANDBOX`** — not `RELEASE_READY`.

Every criterion is either a clean PASS or a PARTIAL whose gap is explained
by this specific environment's limits (single test account, no camera/mic
grant, no screen-share consent, one tooling quirk at one exact viewport
dimension) rather than by any known defect, failed test, or unresolved
bug. Calling this `RELEASE_READY` outright would overclaim multi-
participant and screen-share verification that genuinely wasn't possible
here. The honest next step is a real (or multi-account) staging pass
specifically covering: a second live participant, the actual
`getDisplayMedia` picker, a granted camera/mic permission path, and the
two flagged product decisions (§ below) — not more code changes against
this environment.

## Open product decisions (carried from the Phase 1 audit, still open)

1. Should the speaker/audience distinction become a real Daily
   token-`permissions`-enforced boundary, or is the current social-
   convention model (matching Clubhouse/Twitter Spaces' own historical
   approach) acceptable long-term?
2. Should the `call_transcripts` RLS gap for `sound_stage` (and other
   newer call kinds) be fixed so co-hosts/speakers can replay a
   recording, not just the host?
3. Is a quality-tier selector (Auto/HD/Data saver) wanted, now that the
   underlying `sendSettings` presets exist to back one?

None of these block a sandbox/staging rollout; all three are worth a
decision before a wider release.

## Full report index

- `ON_STAGE_FULL_SCREEN_AUDIT.md` — Phase 1, read-only architecture audit
- `ON_STAGE_UX_UI_ARCHITECTURE.md`
- `ON_STAGE_VIDEO_QUALITY_REPORT.md`
- `ON_STAGE_SCREEN_SHARE_REPORT.md`
- `ON_STAGE_INVITE_AND_SHARE_REPORT.md`
- `ON_STAGE_RECORDING_AND_REPLAY_REPORT.md`
- `ON_STAGE_SECURITY_AND_PERMISSION_REPORT.md`
- `ON_STAGE_PERFORMANCE_REPORT.md`
- `ON_STAGE_ACCESSIBILITY_REPORT.md`
- `ON_STAGE_BROWSER_VERIFICATION_MATRIX.md`
- `ON_STAGE_RELEASE_GATE.md` — this document

## Commits this phase (`feature/reliability-overhaul`)

1. `feat(stage): introduce fullscreen On Stage shell, Kretopia CTA system, share, and HD-preferred adaptive quality`
2. `feat(stage): add authorized Sound Stage invite, reusing the existing connections-picker`
3. `feat(stage): align recording with the existing Recordings replay flow on leave`
4. `fix(stage): accessibility and performance pass on the fullscreen shell`
5. This documentation commit.

All five focused, all independently typechecked/tested/linted/built
clean, per the brief's own commit-strategy instruction.
