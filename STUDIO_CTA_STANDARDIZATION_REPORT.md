# Studio & Landing CTA Standardization

## Canonical implementation
`src/components/ui/cta-button.tsx` — `<CtaButton>` reproduces the landing primary CTA exactly:
`bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md` on the shadcn `Button`, with `size="lg"` for hero use and a `group` arrow slot. It is the single source of truth; `BottomCTASection` and the Studio hero now render the same element.

## Coverage
| Surface | Before | Now |
|---|---|---|
| Landing bottom CTA | inline classes | `CtaButton` |
| Studio home create | bespoke `btn-glass` block | `CtaButton` |
| Studio empty state | ghost/outline mix | `CtaButton` |
| Navbar "Get Started" (desktop + mobile) | `btn-glass btn-glass-primary` | plain solid primary (see rollback report) |

Secondary/tertiary actions keep their existing shadcn variants — the sweep is deliberately limited to primary CTAs so hierarchy stays readable.

## Rendering
Verified identical across mobile and desktop widths, in light and dark chrome routes, and with `prefers-reduced-motion` (no transform-based motion in the canonical CTA).
