# Authenticated feature visual smoke test

Why this exists: the live parity audit of 2026-10-10 (version `daa65de3`) could only reach the public pages. The four below sit behind a signed-in session and were **not** measured. Run this by hand, with your own account, after each release that touches the Wrapped / header / logo system (`FeatureWrapped`, `WrappedShell`, `FeaturePageHeader`, `SceneBanner`, `StudioFeatureShell`).

No credentials and no screenshots belong in this file.

## Pages

| Route | Feature | Wrapped panel to expect | Header scene card |
|---|---|---|---|
| `/desk` | Workspace (Studio) | "Everything in your Studio" (Right now + Projects), after the New Room hero | none: the New Room hero carries the scene |
| `/thrivepay` | KrePay | "Everything in KrePay" | yes (KrePay scene) |
| `/credits` | Credits | "Everything in Credits" | yes |
| `/creative-circle` | Creative Circle | "Everything in Creative Circle" | yes |

## Viewports

Check each page at **1440 px**, **1024 px** and **375 px** (browser devtools device toolbar is enough).

## Per page, per viewport

1. **Width parity.** The header scene card and the Wrapped panel have the same left and right edges (same `max-w-6xl` container, `px-4` gutters). Neither is narrower or wider than the content under it. On Workspace there is no header card: the New Room hero and the Wrapped panel share the same edges.
2. **K-mark and lockup.** Only the Kretopia K-mark and the K + wordmark lockup appear: the card's corner chip ("Kretopia · {feature}"), the lockup on the left of the split card (from 640 px), the lockup at the foot of the Wrapped panel. Nothing stretched, nothing cropped, no broken-image icon, no large faded K cut off by an edge.
3. **Wrapped placement.** One panel, directly after the header block, with the eyebrow "Kretopia · {feature}", the title "Everything in {feature}" and the page's own components inside. No second panel stacked on top of it, no overlap with the header.
4. **No clipping.** No clipped text, no clipped CTA, no control under 44 px tall on 375 px.
5. **No horizontal page scroll.** At 375 px, the page itself must not scroll sideways. A carousel or a tab strip may scroll inside its own container; the page may not.
6. **Reduced motion.** Turn on "Reduce motion" in the OS (or devtools: Rendering, Emulate CSS media feature `prefers-reduced-motion`). Reload. The header title no longer fades up, the status dot no longer pings, loaders no longer spin their ring, and nothing slides in. Scenes are static images and must stay put.

## Per page: who is looking

Run the page as each of these when the page has more than one audience, and note what differs.

| Page | Owner | Collaborator / client | Unrelated signed-in user |
|---|---|---|---|
| `/desk` | sees own Projects and money state | sees only the Projects they were invited to; money only where `can_see_milestone_money` allows | sees an empty Studio, not another person's Projects |
| `/thrivepay` | own wallet, invoices, payouts | no access to the owner's wallet | own wallet only |
| `/credits` | own credits and evidence | n/a | own credits only; another person's credits stay private |
| `/creative-circle` | own tier and referrals | n/a | own tier and referrals only |

For every row, the layout checks above (1 to 6) must hold the same way; only the content differs. A panel that goes blank, shows another person's numbers, or grows a second scrollbar is a failure.

## Record

For each page and viewport write one line in the release notes: `route | viewport | PASS or the check that failed (1 to 6) | account used (owner / collaborator / unrelated)`. Fix only what is proven; do not restyle a page that passes.
