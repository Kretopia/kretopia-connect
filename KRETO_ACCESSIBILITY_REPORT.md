# Kreto Accessibility Report

## Status: `UNIT_TESTED`, `BROWSER_VERIFIED` (spot-check) — no new violations attributable to this pass

## Semantics, per §8

- **Decorative by default**: every `KretoPresence` instance without `onClick` renders inside a `div aria-hidden="true"` — unchanged by this pass, still covered by the original "is decorative (aria-hidden) by default" test.
- **Real control when interactive**: `onClick` + implicit/explicit `label` still produces a real `<button>` with `aria-label` — unchanged, still covered.
- **State in text, never color/motion alone**: extended in this pass. All six non-empty states (`processing`, `proposal_ready`, `success`, `caution`, `error`, `offline`) now have a dedicated `it.each` test asserting the exact `sr-only` announcement text. `idle` and `attentive` correctly have none (nothing to announce for the former; the latter is a hover micro-affordance on a control whose `aria-label` already names its purpose, not an app-state change).
- **Motion is never the only signal**: unchanged — reduced-motion gating (`useReducedMotion()`) sits above every `animate` prop, and the "does not throw... under prefers-reduced-motion" test now exercises the branch with the new state set active (`processing`, same as before — the gating logic itself doesn't vary per state, so this one test covers all of them).
- **No flashing, no color-only status**: `caution`/`error`/`offline` are all static (no animation) per the state machine report, so there is no flashing risk from the new states. `caution` (amber `--warning`) and `error`/`offline` (`--muted-foreground`) are visually distinct from each other and from the `--energy` pink used by the "things are fine/progressing" states, in addition to each having distinct text.
- **No pointer interception, no keyboard obstruction**: the new hover/focus tracking on the interactive button reuses the button's existing `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` — it does not add any new element, does not change the button's hit target, tab order, or focus ring, and does not intercept clicks meant for anything else.

## Live spot-check

Hovered the `KretoLauncher` button on `/today` (authenticated, desktop viewport) via a real DOM `mouseenter`/`mouseleave`/click sequence. No new console errors or accessibility-relevant warnings appeared. The button retained its `aria-label="Open Kreto"`, remained focusable, and remained visually present and clickable after the interaction.

## Pre-existing findings — confirmed unrelated to this pass, not fixed here

Carried forward from prior turns of this rollout, re-confirmed still present and still out of scope for a component-level pass:

- `KretoTip`'s shared CTA button (`background: var(--kretopia-sunset, hsl(327 100% 59%))`, white text) — a color-contrast finding present on every tip group, unrelated to `KretoPresence` itself.
- A Radix tab-trigger contrast issue on Circle's own tab list (`SoundStages`/`Match`/`Browse`/`Network`).
- A `heading-order` issue on the Events page.
- The `<p>`-cannot-appear-as-descendant-of-`<p>` React warning inside `AccountSwitcher`'s `AlertDialogHeader`, observed in this pass's console check — confirmed unrelated: it fires from `AccountSwitcher.tsx`, which this pass never touched.

None of these were introduced or modified by this change; each was already flagged in an earlier report or observed independently in this pass's own console check and traced to files outside this change's diff.
