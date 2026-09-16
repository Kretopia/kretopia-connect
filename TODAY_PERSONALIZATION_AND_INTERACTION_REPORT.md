# Today — Personalization and Interaction Report

## Personalized greeting (§4)

`FeaturePageHeader`'s title/accentTitle in `UnifiedHome.tsx` changed from
the static "What are we moving forward today?" to `{firstName},` /
`here's what moves you forward today.` — `firstName` is the same
already-established safe pattern used elsewhere in this codebase:
`profile?.full_name?.split(" ")[0] || "Creator"` (no `first_name` column
exists in `profiles`; this is the existing, correct fallback chain — never
undefined, never another user's name, never a hardcoded dev/test name).

`ThrivePromptHero`'s own headline was a near-duplicate of the page's h1
("What are we moving forward today?" rendered as an h2 right below the h1
of the same text) — a real pre-existing defect the file's own comment
flagged. Now that the h1 is personalized, leaving the h2 as the old static
text would read as an even more obvious mismatch. Fixed by giving
`ThrivePromptHero` a `firstName` prop and a genuinely different, shorter
prompt: `"What's next, {firstName}?"` — personalized, but never textually
identical to the h1.

**Live-verified**: logged in as a real account, both surfaces show
"Gabriel" correctly and render different text from each other.

## Interactive flow (§5-§7)

Real, working interactions added this pass (not just navigation links):

- **Complete** a task — `TodayFocus` and `MoreFromToday`'s Deadlines list
  both write `project_tasks.status = "done"` directly, no page reload.
- **Snooze** a task — bumps `due_date` to tomorrow.
- **Review / Not now** on an AI proposal — writes `agent_proposals.status`
  (`accepted`/`dismissed`), same table and semantics `SurfaceProactiveCards`
  already used elsewhere in the app; `TodayFocus` reuses the identical
  pattern for its own single-item case.
- **Open Project** — navigates to `/desk/:id` from both the Focus card and
  each Deadlines row.
- **Filter** — `MoreFromToday`'s chip row (All/Approvals/Deadlines/Discover/
  Schedule) is real component state gating which sections render, with live
  counts on the Approvals/Deadlines chips.
- **See all** — `Momentum` and the Sound Stages sub-section both link out.

Animations: staged entrance (Today Focus → More from Today → Momentum fade
up in sequence, 80ms apart), a completion micro-transition in `TodayFocus`
(the card swaps to a green "Nice work" confirmation for ~900ms before
reloading), and `AnimatePresence`-driven per-item transitions in the
Deadlines list. All gated through the existing `useReducedMotion()` hook —
every `motion.*` element's `initial` collapses to `false` (no animation)
when reduced motion is on, matching the app-wide convention documented in
`MOTION_SYSTEM.md`. No layout-shifting animations, nothing blocks content
behind motion, no infinite decorative loops were added.

## Not independently verified

Keyboard-only tabbing through the new filter chips and per-row action
buttons (all are real `<button>` elements with the existing focus-visible
utility classes, but not manually tabbed through this session). OS-level
`prefers-reduced-motion` was not toggled live to confirm the animation
collapse — verified by code path only (same hook, same pattern as ~48
other files already using it correctly).
