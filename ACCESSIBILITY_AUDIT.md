# Accessibility & Responsive Audit

## What's already in place (verified, not newly built)

- **Global focus-visible ring** (`src/index.css:351-357`) — keyboard focus is visibly indicated app-wide via `:focus-visible`, distinct from mouse-click focus (`:focus:not(:focus-visible)` suppressed).
- **Icon button touch target** — the shared `Button` component's `size="icon"` variant defaults to `h-10 w-10` (40×40px), close to the WCAG 2.5.5 AA guidance. Individual call sites that override this down to `h-8 w-8`/`h-6 w-6` exist (dense grids, hover-revealed micro-controls) — not swept here; flagged below as a scoped follow-up if it matters for a specific surface.
- **Modals, sheets, popovers, dropdowns are almost all built on Radix UI primitives** (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`) via shadcn/ui — Escape-to-close, focus trapping, `role="dialog"`/`aria-modal`, and return-focus-on-close are handled by Radix itself, not hand-rolled. **Correction to an earlier claim in this file:** a later pass found one real exception — `VoiceFirstCreateModal.tsx` (the New Room flow) is a custom `fixed inset-0` overlay, not a Radix Dialog, and had none of that for free (no Escape handling, no `role="dialog"`, no focus management). Fixed: Escape-to-close, initial focus on the close button, `role="dialog"`/`aria-modal="true"`/`aria-label`, and a label on the previously-unlabeled close button itself. Live-verified via `document.activeElement` and DOM inspection after Escape. Does not yet include full focus-cycling (tab-wrapping) — flagged as a smaller remaining gap, not claimed as complete.
- **`prefers-reduced-motion`** — global CSS rule (`src/index.css:841`) collapses all animation/transition durations to near-zero; covered in [ANIMATION_AUDIT.md](ANIMATION_AUDIT.md).
- **Route-level tab semantics** — Scout's segmented control uses correct `role="tablist"`/`role="tab"`/`aria-selected` (and, as of this pass, no longer includes a tab that navigates away — see the Phase 3 commit). All carousels added in the Passport rearchitecture (Stamps, and the four Co-Signs evidence carousels) carry `aria-label` on the carousel region and on every Previous/Next control, following the same pattern already established by the Studio rails.

## Icon-only button labeling — real gap, too large to fully remediate in this pass

Heuristic sweep: `size="icon"` buttons with no `aria-label` anywhere in the same file and no `sr-only` text either.

```
grep -rln 'size="icon"' src/components src/pages --include="*.tsx" | xargs grep -L "aria-label" | xargs grep -L "sr-only"
```

**121 files** matched originally. This overcounts slightly (a file can have several icon buttons where only some lack labels), but sampling confirmed a real, common pattern: icon-only dismiss/close/action buttons with nothing for a screen reader to announce beyond "button."

**Fixed so far, across two passes:**
- `src/components/discover/QuickMatchBanner.tsx` (Charter B) — dismiss (X) button; `aria-label="Dismiss"`.
- 25 more files, 46 buttons (Charter C, Phase 7) — a scoped background pass through the first 25 files of the reproducible list above, each button's purpose read from its real onClick handler/icon rather than guessed, with per-item names included where already in scope (e.g. `Remove ${member.full_name}`, `Delete saved search "${s.name}"`). Zero unclear-purpose buttons — every one was determinable from context. Verified with a clean `tsc --noEmit` and an eslint diff confirming no new rule categories, only pre-existing baseline errors on untouched lines. Committed as `3490e0e3`.

**Remaining: 95 files.** Same reproducible grep, re-run after the fixes above. This is still a real, bounded, mechanical task — recommend continuing in batches of ~25 the same way, since that size keeps each pass's diff reviewable and each `tsc`/`eslint` verification fast.

## Responsive

Not newly audited beyond what earlier phases in this session already covered (mobile-width blur reduction in the Liquid Glass system, bottom-nav/hamburger breakpoint parity confirmed correct in [UX_NAVIGATION_AUDIT.md](UX_NAVIGATION_AUDIT.md)). No new responsive issues surfaced while working the surfaces touched in this pass (Scout, Kreto, Onboarding, QuickMatchBanner).
