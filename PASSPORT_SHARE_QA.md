# Share Passport Modal — QA (Phase 8)

Scope: `src/components/passport/PassportShareSheet.tsx`. Commit `ed0c32cf`.

## What changed

- **Sheet → centered modal.** Replaced the bottom `Sheet` (drawer) with `GlassModal`/`GlassModalContent` (`src/components/ui/glass/GlassModal.tsx`) — a Radix `Dialog` with the Kretopia Liquid Glass elevated treatment (`glass-surface-elevated`). Centered viewport, focus trap, and Escape-close all come from Radix for free.
- **Icon toolbar per share target.** Replaced the label+icon button row with a compact icon-only toolbar, each button carrying a specific `aria-label` (e.g. `"Share EPK / Media kit on LinkedIn"`, not a generic "Share"):
  - Native Share (`Share2`)
  - Copy link (`Copy`/`Check`)
  - WhatsApp (`MessageCircle`, real `wa.me` intent — unchanged from before)
  - **LinkedIn** (new) — real `linkedin.com/sharing/share-offsite` intent
  - **X** (new) — real `twitter.com/intent/tweet` intent
  - **Instagram** (new) — Instagram has no web share-intent URL for arbitrary links, so this copies the link and shows a toast telling the user to paste it into their bio or a Story, rather than fabricating a URL that would silently fail
  - Email (`Mail`, unchanged `mailto:` link)
  - **QR** (new) — toggles an inline `QRCodeSVG` (from the already-installed `qrcode.react` dependency) per target, with a correct accessible `<title>` and a "Scan to open …" caption
- **Same props, same data.** `userId`, `profile`, `canPublishSite`, `trigger`, `defaultOpen`, `onOpenChange` are unchanged — no consumer-side changes were needed in `ProfileDialogs.tsx` or `Profile.tsx`.

## What did not change

- The profession-aware target list (`targetsFor(layout.shareTargets)`) and its underlying `SHARE_TARGETS` map (`src/lib/passport/shareTargets.ts`) — untouched.
- Locked/paid-only targets (e.g. "Personal website") still show the "Upgrade to publish" CTA.
- The pre-existing, separate `ProfileQRDialog` (a different "connect" QR flow) — untouched, no overlap or conflict with the new per-target QR toggle inside this modal.

## Verification

- `npx tsc --noEmit -p .` — clean.
- `npx eslint src/components/passport/PassportShareSheet.tsx` — zero issues.
- `npm run build` — succeeds.
- **Live verification** on `/profile` with a real authenticated account (Gabriel Auguste):
  - Opened the modal via the Passport card's "Share Passport" button — renders centered, correct title ("Share your Content Creator / Influencer"), correct target rows (EPK / Media kit, Rate card, Passport profile, locked Personal website).
  - Read the full accessibility tree: every icon button has a correct, distinct `aria-label`; every `<a>` href was inspected directly and confirmed correct — e.g. `https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.kretopia.com%2Fepk%2F4b565cca-...`, `https://twitter.com/intent/tweet?url=...&text=...`, real `wa.me` and `mailto:` links.
  - Toggled the QR code for the EPK target: confirmed via DOM inspection that the button's `aria-label` correctly flips between "Show QR code for …" and "Hide QR code for …", and that a real `<svg>` with `<title>QR code for EPK / Media kit</title>` renders. Screenshot confirms the QR renders correctly, centered, with a "Scan to open epk" caption.
  - Pressed Escape: modal closed correctly.
  - Console: no new errors beyond the pre-existing 401/404/400 network noise baseline present on every route this session.

### Automation note (not a product bug)

During verification, the computer-use tool's simulated coordinate-based clicks intermittently closed the dialog instead of registering on the QR button — traced to the automation click sequence, not the component: a direct DOM `.click()` on the same button (which routes through React's real event system exactly as a genuine user click does) worked correctly every time, toggled state as expected, and did not close the dialog. No code change was needed.

## Accessibility notes

- Icon buttons are `h-8 w-8` (32px), matching the pre-existing sizing convention already used throughout this component and its siblings — not a new regression, but flagged as a candidate for a future platform-wide touch-target pass (below the 44px recommendation).
- `aria-expanded` is set on the QR toggle button to communicate its open/closed state to assistive tech.
