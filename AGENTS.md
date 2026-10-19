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
- Today uses three TodayCard shells in TodayDeck: Passport/Kreto, one real next action, supporting live activity. Use 3D roulette for fine pointers, native touch swipe and flat reduced motion; each card gets its own KretoScene, never cut-outs or Holo. Place one TodayRadar after them with next event, people, nearby events, gigs, live Stages and proposals. Keep deeper metrics in Passport and next event/Discover Creatives in Radar; every line needs a real field to prevent duplicate dashboards and invented signals.
- Keep legacy backend schema types and the client adapter in separate authored files mapped by exact import aliases, because Cloud regenerates its empty schema files and production still uses the legacy backend.
- Search people through the public-safe profile view for guests and rank accepted viewer connections before other name matches for signed-in users, because discovery must work without login while relationship priority stays private.
- Keep Landing's editorial shell on the shared theme tokens and preserve photographic overlays separately, because the navbar Daylight/Midnight control must affect the whole page without reducing image-caption contrast.
- Put feature tutorial triggers in the shared header's centered pre-title slot, replacing the eyebrow only when a tour exists, because each feature needs one consistent action above its heading.
- Keep Hero's official body/arm layers aligned, Flying palette and lenses intact, sized by `HELMET_OF_BOX`; preserve elbow pivot and HD assets, because the takeoff must not jump or affect other mascot surfaces.
- Reuse FeatureTutorialDialogContent for feature and Landing tutorial modals, because a shared surface prevents theme and interaction drift; keep Landing CTA pairs in equal grid tracks.
- Gradient title text (`.k-gradient-text`) must keep `box-decoration-break: clone` with its padding, because without it a wrapped gradient phrase loses its clip slack at the line break and the browser cuts italic overhangs and descenders mid-title.
- Use KretopiaSpinner (inline) or KretopiaLoader (block) for waits; never Loader2, border rings, spinning icons or bare "Loading…". Content-shaped Skeletons are allowed; shared K-mark loaders keep waits on-brand.
- Resolve account mode through the shared user-keyed account-tone query and publish successful switches into it, because independent profile reads leave navigation and features in conflicting modes.
- Render Company Studio through the existing project workspace with additive hiring actions, because projects, invitations, permissions and the single-row carousel must remain identical across modes.
- Gate Creator finance overview surfaces with the shared account mode in KrePay while reusing its payment workflows and scene header, because Company presentation must not duplicate Creator summaries or fork payment logic.
- Serve native fast-start chapter videos without posters; prioritize the first chapter and warm later videos near entry without restarting resource selection, because still flashes and duplicate loads delay playback. Preserve each chapter's crop.
- Keep Landing flight imperative with one predecoded exclusive pose beneath opaque media; contiguous eased peek slides share Flying endpoints, outer-only hysteresis and full-box heading corridors without near-media rotation, because only media may hide Kreto and transitions must follow scroll direction.

- Use FeaturePageHeader and WrappedShell/StudioFeatureShell for Spotlight, About and Hire Talent; group optional content in tabs/disclosures.
- Omit page back rows; retain step navigation, reader close and sidebar dismissal.
- Call reminders reuse live state and sync; explicit Stop/Save uses Daily events and recording IDs.
- Key Match cards by profile; complete one exit before advancing and neutralize Passport Holo tilt during gestures to avoid stale drag state.
- Page discovery before exclusions; deduplicate quiet top-ups and retain consumed IDs to prevent suggestion starvation.
- Let Workbox own HTTP-cache expiration and defer local housekeeping, because deleting unrelated caches forces repeat downloads.
- Split Home and optional global mascot UI with separate Suspense boundaries, because unused code must not block pages.
- Mount Landing chapters after Hero's first render, warm videos near the viewport and reveal text before entry, because late downloads and invisible entrances compound waiting.
