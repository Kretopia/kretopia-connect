# Landing Day/Night Visual QA

## Status: `AUDITED`, `BROWSER_VERIFIED`

## The real finding: there is no "Day/Night" toggle live today

The app's `ThemeProvider` is configured `defaultTheme="light"`, `enableSystem={false}` ([main.tsx](src/main.tsx)) — but `VibeThemeSync.tsx` overrides this unconditionally on every mount:

```tsx
useEffect(() => {
  // V1: Midnight locked. Ignore stored/profile vibe until picker returns post-launch.
  applyVibe("midnight", setTheme);
}, [setTheme]);
```

Every real visitor — guest or logged-in — is force-set to `data-vibe="midnight"` and the `.dark` class the moment the app mounts, regardless of stored preference, system setting, or the `ThemeProvider` default. This is a documented, deliberate V1 constraint, not a bug. Confirmed by clearing `localStorage` entirely and reloading: the app still came back dark, because the vibe lock re-applies itself every mount rather than reading any stored value.

**Practical consequence: today, every visitor to Landing sees exactly one visual state — the dark "midnight" one already screenshotted extensively in this overhaul's other reports.** There is no reachable light-mode Landing experience to QA yet.

## What was verified for the state that IS real

- All of Landing's own section backgrounds and text colors are hardcoded hex values (`#05070D`, `#FF2DA1`, `rgba(255,255,255,…)`) via inline styles, not CSS custom properties — confirmed by grep across `src/components/landing/`. This means Landing's own look is theme-invariant by construction; it would render identically even if the vibe lock were lifted, **except** for one system built during this overhaul.
- Verified at 390×844, 768×1024, and 1440×900 in the one live state (dark): hero, chapter sections, tutorial dialogs, footer, and CTAs all render correctly with no unstyled flashes or missing tokens — see [LANDING_BROWSER_VERIFICATION_MATRIX.md](LANDING_BROWSER_VERIFICATION_MATRIX.md) for the itemized pass list.

## The one exception, and a real latent risk it exposes

`.btn-landing-primary` (this overhaul's new canonical CTA gradient) is the one piece of Landing styling that deliberately **does** read live theme tokens — `background-image: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--energy)) 100%)` — specifically so it inherits the app's real brand tokens rather than a hand-picked hex pair. `--energy` (the pink stop) is identical in both light and dark theme blocks in `index.css`, but `--secondary` is not:

| Theme | `--secondary` | Rendered gradient start |
|---|---|---|
| Dark (today's only reachable state) | `222 22% 13%` | `rgb(26, 30, 40)` — dark charcoal |
| Light (locked out today, but defined in CSS) | `36 18% 93%` | `rgb(240, 238, 234)` — pale cream |

Both were checked directly (not just read from CSS source) by toggling the `.dark` class on `document.documentElement` at runtime and reading the button's computed `background-image`. The dark state is what every user sees today and looks correct — verified in every screenshot across this whole engagement. The light state was previewed the same way (screenshot below) purely because `VibeThemeSync`'s effect only re-applies once per mount, so manually removing `.dark` after load sticks long enough to inspect:

**Confirmed visually**: with the pale-cream gradient stop, the button's hardcoded white text (`.btn-landing-primary { color: #fff }`) is visibly harder to read over the "Build my" portion of the label (the cream end) than over "Passport" (the pink end) — a real, if currently unreachable, WCAG-adjacent contrast dip. The same test on `NewsletterPopup.tsx`'s default `<Button>` (which resolves to `.btn-glass-primary`, a related but separate translucent-glass gradient system) showed the same failure mode more severely: its dialog surface itself flips to a near-white card in light mode, and the hardcoded white submit-button text becomes close to illegible against it. In today's actual dark-locked state, the same modal was re-checked and renders correctly (dark card, legible white-on-tinted-pink button).

**This is not a bug in anything shipped today** — light mode is not selectable by any real user. It is, however, a concrete pre-requisite worth flagging clearly for whoever re-enables the vibe picker post-launch: any component using `.btn-landing-primary` or `.btn-glass-primary`'s hardcoded white text needs a contrast check against the light-theme token values before that toggle ships, or it should get a light-mode-specific text color the same way this overhaul's dark-pink badges (`featureVisuals.tsx`, `VerifiedCreditsChapterSection.tsx`) were fixed to use dark text instead of white in [LANDING_ACCESSIBILITY_REPORT.md](LANDING_ACCESSIBILITY_REPORT.md). Not fixed here because it isn't reachable today and doing so blind (without the picker itself to test against) risks guessing wrong about the eventual design.

## Scope note

An unrelated, unsolicited finding surfaced while forcing the theme toggle for this test: `NewsletterPopup.tsx` shows an interruptive modal to any guest after a fixed 30-second timer, app-wide (not Landing-specific, gated only by "not previously dismissed" and "not logged in"). It isn't part of this Landing overhaul's scope to change, but given the brief's explicit "no interruptive dark patterns" requirement for Landing itself, it's worth the product owner's attention that this exists as a related, adjacent pattern outside Landing's own components.
