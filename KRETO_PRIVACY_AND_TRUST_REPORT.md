# Kreto Privacy and Trust Report

## Status: `AUDITED` — compliant by construction

## Props surface (the whole attack surface for this concern)

`KretoPresenceProps` is exactly `{ state?, size?, label?, onClick?, className? }`. `state` is a closed enum of 8 literal strings; `size` is a closed enum of 5 literal strings; `label` and `className` are caller-supplied strings for the *button's own* accessible name and styling, not data about any user. There is no prop through which a user avatar, name, project title, financial figure, ranking score, or any other private/personal data could reach this component — it is architecturally impossible for a caller to pass user data into `KretoPresence`, let alone display it, because the component has no code path that reads or renders anything but its own fixed SVG plate and the fixed `KretoMark` badge.

## No false claims about product state

Audited every live call site (`KretoLauncher.tsx`, `KretopiaHero.tsx`, `KretoTip.tsx`) and confirmed each passes `state="idle"` unconditionally — none currently claims processing, a ready proposal, success, caution, or an error/offline condition, so none can currently be mismatched against reality. The one path that could produce a real non-idle claim (`KretoTip`'s canned `tip.prompt`/`tip.cta` copy) never triggers a state change on its own; opening Kreto via its CTA only dispatches the existing `thrive-copilot:open` event, it does not flip `KretoPresence` into `proposal_ready` or `success` — there is no proposal or completed action to honestly claim yet at that point.

## `offline` — the one state that could be wired dishonestly, and isn't

Per `KRETO_STATE_MACHINE_REPORT.md`, `offline` is implemented but has zero real callers. This report exists partly to make that explicit: nothing in this codebase currently tracks connectivity, so nothing should claim `offline` without first building a real signal (e.g. a genuine backend-availability check, not `navigator.onLine`, which reports local network state, not "is Kreto's backend actually reachable" — a meaningful distinction the brief's own "never imply... a Call was found... unless actual product data confirms it" rule implies matters here too).

## No social proof, no exposed presence/attendance/financial data

Confirmed by the same props-surface argument above: since `KretoPresence` cannot receive user-scoped data at all, it cannot be used to imply another user is online, a Call was found, an event has attendees, or a financial figure exists — doing so would require a different component or a new prop, neither of which this pass added.

## No arbitrary user images

Every visual element in `KretoPresence` is either inline SVG (drawn, not a photo) or the pre-approved `KretoMark` PNG asset (`kretopia-k-mark.png`, the same asset used in the navbar). No `<img>` other than that one asset appears anywhere in the component, at any size, in any state — confirmed by reading the full render output above.
