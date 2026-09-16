# Deadline Day — Browser Verification

## Status: partial. Verified everything reachable without an authenticated host/participant account or existing event/comment data — genuinely blocked on the rest, documented explicitly below rather than claimed.

## What was verified live (this round)

**Landing** — dev server, anonymous session, all three required breakpoints (390×844, 768×1024, 1440×900):
- Primary CTA (`Claim your Passport`) confirmed as a real `<a href="/auth?tab=signup&intent=hero">`, visible without scrolling at every breakpoint.
- Secondary CTA ("Sign in") present exactly once.
- Sticky mobile CTA appears correctly on scroll past the hero, doesn't obscure content.
- No horizontal overflow at any breakpoint.
- No new console errors beyond the same pre-existing anonymous-session backend noise (401/404 from gated endpoints) seen consistently throughout this project.
- One non-issue logged: nav logo images render broken in this specific local dev preview due to Lovable's own dev-mode asset-tagger rewriting URLs to a proxy path that doesn't resolve in this sandboxed environment — not expected in production, not fixed.

**Security spot-checks** (curl against live production, anon key):
- `opportunities.guest_email`/`verification_token` — confirmed still locked (`permission denied for table opportunities`), no regression of the fix from the original Deadline Day round.
- `get_mutual_connection_counts`/`get_mutual_connections` RPCs — confirmed live and correctly rejecting unauthenticated calls (verified when originally shipped this session; not re-tested today since nothing has touched them).

**Events discovery page** (`/meetup`) — loads correctly, shows a genuine empty state ("No events yet — be the first to host one") rather than an error, confirming the page itself isn't broken even though there's no data to browse.

## What could not be verified, and exactly why

- **Event comment moderation fix** (host deleting another participant's comment) — requires an authenticated host account plus another authenticated participant who has posted a comment on a real event. Neither exists in this environment. `NOT_CONFIRMED`.
- **Co-host copy fix** — purely a text change, low risk, but requires an authenticated host viewing the co-host dialog to see it rendered. `NOT_CONFIRMED`.
- **`EventCommunityHub`'s new tabs** (Who's Going / Chat / Comments) — requires a real, public event to exist. The local database currently has **zero public events** (`/meetup` confirmed empty after clearing a stale search filter), so `/event/:id` cannot render real content in this environment at all. `NOT_CONFIRMED`.
- **Comment delete button's new `aria-label`/keyboard-focus fix** — same blocker as above.

None of these are code-quality concerns — they're the well-established, repeated limitation of this environment (no seeded test accounts or event/comment data), the same limitation documented at every prior phase of this entire project.

## Recommendation for closing the loop

Once a real host account and a real public test event exist (either seeded or created by hand), a single pass covering these four items would fully close out this round's `NOT_CONFIRMED` list:
1. Post a comment as participant B, delete it as host A, hard-refresh, confirm it stays deleted.
2. Open the event page as any authenticated viewer, confirm the Who's Going / Chat / Comments tabs render and switch correctly, with counts/content matching what was there before (nothing lost).
3. Tab to the comment delete button with keyboard only, confirm it becomes visible on focus (not just hover) and is announced with a real name by a screen reader.
4. Open the co-host dialog as host, confirm the corrected copy displays.
