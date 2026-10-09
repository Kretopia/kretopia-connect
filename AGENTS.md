<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `desk-agent-watch` disabled while the production legacy backend is active, because that optional function cannot resolve current Studio project IDs.
- Keep Studio project cards in one scrollable, keyboard-accessible row with all filtered results mounted, because a capped grid hides projects and creates excessive page height.
- Keep Passport's action, trust and record in one compact overview, and read Reach only from connected-platform syncs, because separate panels and stale profile counters misrepresent the creator's status.
- Reuse the shared KretopiaQRCode for Passport QR previews and exports, because one branded generator preserves the same scannable code across surfaces.
- Keep Today's three primary cards (Passport/Kreto, one real next action, supporting live activity) on one TodayCard shell inside TodayDeck (3D roulette for fine pointers, native swipe on touch, flat when motion is reduced), with the next event and Discover Creatives after them and never before; deeper Passport metrics belong in Passport, because duplicate dashboards obscure the creator's priority.
- Keep legacy backend schema types and the client adapter in separate authored files mapped by exact import aliases, because Cloud regenerates its empty schema files and production still uses the legacy backend.
- Search people through the public-safe profile view for guests and rank accepted viewer connections before other name matches for signed-in users, because discovery must work without login while relationship priority stays private.
- Keep Landing's editorial shell on the shared theme tokens and preserve photographic overlays separately, because the navbar Daylight/Midnight control must affect the whole page without reducing image-caption contrast.
- Put feature tutorial triggers in the shared header's centered pre-title slot, replacing the eyebrow only when a tour exists, because each feature needs one consistent action above its heading.
- Keep Hero mascot reflection artwork in aligned body/arm layers, because recoloring must preserve the existing waving animation and leave other mascot surfaces unchanged.
- Reuse FeatureTutorialDialogContent for feature and Landing tutorial modals, because a shared surface prevents theme and interaction drift; keep Landing CTA pairs in equal grid tracks.
- Gradient title text (`.k-gradient-text`) must keep `box-decoration-break: clone` with its padding, because without it a wrapped gradient phrase loses its clip slack at the line break and the browser cuts italic overhangs and descenders mid-title.
- Use KretopiaSpinner (inline) or KretopiaLoader (block) from components/brand/KretopiaLoader for every loading or waiting state, never lucide's Loader2, CSS border rings, spinning icons or bare "Loading…" text, because one K-mark loader keeps every wait on-brand (ESLint blocks the lucide loaders; Skeletons for content-shaped placeholders are fine).
