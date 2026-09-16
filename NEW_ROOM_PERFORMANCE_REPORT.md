# New Room — Performance Report

## Findings

No P0/P1 performance issues found in the audit or this pass's changes. `extract-brief` is a single request/response (no streaming, no chaining) — appropriate for this latency budget given the UI already shows honest indeterminate progress rather than promising real-time streaming it doesn't do. Voice/file processing runs off the main render path via async handlers already. `sessionStorage` draft persistence (`new_room_draft:${user.id}`, 24h TTL) is small and synchronous — negligible cost.

## Duplicate-request risk

Not a performance concern specifically, but adjacent: the `creating` boolean disables the Create buttons during the insert, preventing an obvious double-submit UI path. The deeper duplicate-project risk (network retry after an ambiguous response) is a correctness/idempotency issue, covered in `NEW_ROOM_APPROVAL_AND_SECURITY.md`, not a performance one.

## Changes made this pass and their performance impact

- Analytics instrumentation (11 new `trackEvent` calls at real state transitions): each is a single `supabase.from('analytics_events').insert(...)` fire-and-forget call, wrapped in the existing `trackEvent`'s own try/catch that never blocks or throws. Negligible added latency, no new render-blocking work.
- Extracting `inferWorkspaceType` to its own module: no runtime cost change (same function, same call sites), only an import path.
- Color-token replacement (hardcoded hex → `hsl(var(--energy))` strings in inline styles): no measurable cost difference — same number of style properties, same specificity.
- Focus trap: a `keydown` listener already existed for Escape; the Tab-handling branch added to it does a `querySelectorAll` scoped to the modal only when Tab is pressed while open, not on every render or keystroke — bounded, cheap.

## Not measured this pass

Real modal-open-to-interactive timing, real transcript/draft-generation latency percentiles, real route-transition timing into the created Studio room — none of these were instrumented with actual timing measurements in this pass; the `newRoomDraftReady`/`newRoomCreationFailed` events added this pass give the infrastructure to compute duration-between-events from real usage going forward, but no dashboard or measurement was built.
