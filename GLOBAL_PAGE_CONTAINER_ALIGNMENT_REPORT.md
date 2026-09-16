# Global Page Container Alignment — Today vs KrePay

Scope: direct class match for this pass (the other open option — a shared
`PageContainer` component — wasn't chosen; noted below as a follow-up worth
doing before a third page drifts).

## Before

| | Today (`UnifiedHome.tsx`) | KrePay (`ThrivePay.tsx`) |
|---|---|---|
| Classes | `container mx-auto max-w-5xl px-4 sm:px-6` | `mx-auto px-3 sm:px-4 max-w-7xl` |
| `container` util | yes | no |
| max-width | `max-w-5xl` | `max-w-7xl` |
| horizontal padding | `px-4 sm:px-6` | `px-3 sm:px-4` |

Two different max-widths and two different padding scales for what's
supposed to be one consistent app shell.

## After

Today's two container divs (top wrapper around the dashboard, bottom
wrapper around the footer links) now use KrePay's exact classes:
`mx-auto px-3 sm:px-4 max-w-7xl` — dropped the Tailwind `container` utility
(KrePay never used it either) and matched both the max-width and the
horizontal padding scale exactly, per the spec's "KrePay is the canonical
reference, don't independently invent page margins."

## Verified

Live in the browser: Today's dashboard content now visibly spans the same
width as KrePay's page shell at the same viewport — confirmed by comparing
screenshots of both pages side by side at the default desktop viewport.
Not re-verified across all seven required breakpoints (375×667 through
1440×900) — only the default Browser pane viewport was used this pass.

## Follow-up not done this pass

No shared `PageContainer` component was created — `grep -rl "PageContainer"
src` still returns nothing. Today and KrePay now match by direct class
duplication, which means a future edit to one page's container classes
won't automatically propagate to the other. If Messages/Scout/Menu's
container widths need the same treatment later in this overhaul, worth
reconsidering a real shared component at that point rather than a third
independent copy-paste.
