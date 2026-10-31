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
- Kreto's Cloud control endpoint validates the existing account session and reads/reserves the same Cloud ledger; manual chat forwards to the existing legacy conversation endpoint, never enabling legacy automation or migrating auth/data.
- Provider receipts and workspace-catalog pricing snapshots feed measured Cloud model costs; reservation estimates never become recorded charges, and missing receipts block further gated calls pending reconciliation.
- Kreto attachments use private Cloud originals and service-only text/reference rows bound to owner-readable legacy messages; signed opens and deletion stay in the authenticated control endpoint, and one daily cleanup removes expired files before references.
- Scout shares ScoutGigCard across For You, catalog and shortlist surfaces, retains source-specific actions, and uses native field rails plus progressive filter disclosures; this avoids divergent cards without changing save IDs or backend rules.
- Scout and Match use FeatureSectionNav; Browse groups existing ranked results by Passport craft and reuses ScoutFieldCarousel and CreatorPassportCard, because common presentation must not fork discovery queries or consent actions.
- Connected passes its accepted profiles into the lazy Three.js KretoNetworkScene and uses one progressively disclosed network workspace, because duplicate connection fetches and independent panels obscure the real relationships. No scene interaction writes or auto-accepts relationships.
- Keep Studio project cards in one scrollable, keyboard-accessible row with all filtered results mounted, because a capped grid hides projects and creates excessive page height.
- Keep Passport's action, trust and record in one compact overview, and read Reach only from connected-platform syncs, because separate panels and stale profile counters misrepresent the creator's status.
- Embed Passport intelligence inside the identity surface; keep EPK drafts in user-keyed device storage and preserve original PDFs separately from page-edited copies. Publish only after explicit confirmation to the existing owner-scoped portfolio EPK path and render it on owner/public Passports without profile or schema changes, because imports must remain intact and private until approved.
- Render EPK Live Preview from the actual generated or uploaded PDF with a lazy PDF.js viewer; use pdf-lib for explicit page edits, because a separate HTML mockup diverges from exported documents.
- Use KretopiaQRCode for Passport previews/exports so branded codes stay consistent and scannable.
- Today uses three TodayCard shells in TodayDeck: Passport/Kreto, one real next action, supporting live activity. Use 3D roulette for fine pointers, native touch swipe and flat reduced motion; each card gets its own KretoScene, never cut-outs or Holo. Place one TodayRadar after them with next event, people, nearby events, gigs, live Stages and proposals. Keep deeper metrics in Passport and next event/Discover Creatives in Radar; every line needs a real field to prevent duplicate dashboards and invented signals.
- Keep legacy backend schema types and the client adapter in separate authored files mapped by exact import aliases, because Cloud regenerates its empty schema files and production still uses the legacy backend.
- Search people through the public-safe profile view for guests and rank accepted viewer connections before other name matches for signed-in users, because discovery must work without login while relationship priority stays private.
- Use shared theme tokens for Landing's editorial shell; keep photographic overlays separate so Daylight/Midnight themes the whole page without losing caption contrast.
- Put feature tutorial triggers in the shared header's centered pre-title slot, replacing the eyebrow only when a tour exists, because each feature needs one consistent action above its heading.
- Keep Landing body/arm layers aligned with the flight sprite, preserving the wave pivot, flight controller, timing and scroll locks; seasonal artwork must not replace movement logic or affect other mascot surfaces.
- Reuse FeatureTutorialDialogContent for feature and Landing tutorial modals, because a shared surface prevents theme and interaction drift; keep Landing CTA pairs in equal grid tracks.
- Gradient title text (`.k-gradient-text`) must keep `box-decoration-break: clone` with its padding, because without it a wrapped gradient phrase loses its clip slack at the line break and the browser cuts italic overhangs and descenders mid-title.
- Use KretopiaSpinner (inline) or KretopiaLoader (block) for waits; never Loader2, border rings, spinning icons or bare "Loading…". Content-shaped Skeletons are allowed; shared K-mark loaders keep waits on-brand.
- Resolve account mode through the shared user-keyed account-tone query and publish successful switches into it, because independent profile reads leave navigation and features in conflicting modes.
- Render Company Studio through the existing project workspace with additive hiring actions, because projects, invitations, permissions and the single-row carousel must remain identical across modes.
- Gate Creator finance overview surfaces with the shared account mode in KrePay while reusing its payment workflows and scene header, because Company presentation must not duplicate Creator summaries or fork payment logic.
- Serve native fast-start chapter videos without posters; prioritize the first chapter and warm later videos near entry without restarting resource selection, because still flashes and duplicate loads delay playback. Preserve each chapter's crop.
- Use CDN-hosted lightweight H.264 chapter videos with VP9 fallback, keep original masters untouched, warm the first chapter regardless of viewport width unless data saver is enabled, and defer other transfers until nearby; this reduces bandwidth without making phones wait or leaving unsupported browsers blank.
- Keep Landing flight imperative and exclusive above text/below media; measure hanging size by helmet width, isolate glove contours, and use eased scroll locks and destination headings, because media alone hides Kreto without pose jumps.

- Use FeaturePageHeader and WrappedShell/StudioFeatureShell for Spotlight, About and Hire Talent; group optional content in tabs/disclosures.
- Omit back rows; keep step navigation, reader close and sidebar dismissal.
- Call reminders reuse live sync/Daily IDs. The shell owns Studio calls; route/minimize changes resize one iframe, never rejoin. Safe-area chrome reads Daily state; refresh starts idle and exit requires confirmation.
- Key Match cards by profile; HoloCard tilts only for a fine pointer, tracked on its stable wrapper (never the tilted face) and flat for touch and reduced motion, because tracking the face made corners tremble.
- Page discovery before exclusions; deduplicate quiet top-ups and retain consumed IDs to prevent suggestion starvation.
- Let Workbox own HTTP-cache expiration and defer local housekeeping, because deleting unrelated caches forces repeat downloads.
- Isolate Home/mascots with Suspense; mount chapters after Hero, warm nearby videos and reveal text early to avoid delays.
- Share KretoTyping in Studio Make/launcher; pause offscreen/reduced motion.
- Reuse PassportCollaborationCta and pending invite flows; connection is not consent.
- Keep Discover on FeaturePageHeader, StudioFeatureShell and two Wrapped panels (live signals, then lanes); reuse the Radar fetchers/keys and the shared pill classes, because a second layout or count definition drifts from Scout and Today.
- Use PublicPresenceSearch for pre-account discovery on Auth; keep Hero and navbar on UnifiedSearchDropdown with public-safe guest results, because discovery must preserve their original search surfaces. Navbar guest results navigate directly to profiles. Stage selected sources as unverified intent without creating credits, because discovery is not proof of ownership.
- Keep public web search fail-closed behind a server-only activation switch and a service-role-only atomic quota RPC; AI can rank supplied sources only, because deployment alone must not enable unbounded spend or invented identities.
- Host public web search on the Lovable Cloud backend and call it via `publicWebSearchEndpoint.ts` (publishable key only), never through the legacy client, because the legacy production backend cannot receive deployments or migrations.
- Stream sourced Web results before AI ranking through the shared search endpoint, with bounded public-only memory caching and request coalescing, because ranking must not block usable sources or duplicate paid requests across search surfaces.
- Run the read-only public-search GitHub preflight against the existing app target before deployment; never print provider secrets or apply unrelated migrations, because GitHub secrets may target a different backend.
- Ship the large Kreto cutouts as lossless WebP (PNGs stay in src/assets/brand/kreto as source of truth), because the PNG set cost 4.2MB per fresh load and the WebP copies are pixel-identical.
- Keep vendor splitting through plugins/vendor-chunks.ts (react-vendor, supabase-vendor, motion-vendor, i18n-vendor, sentry-vendor), with CommonJS helpers in react-vendor, because assigning React's interop helper to a consuming chunk creates a startup cycle and leaves the boot loader stuck.
- Add new lazy routes to src/lib/routePrefetch.ts when adding them to App.tsx, because hover/focus prefetch is what makes navigation feel instant.
- Load webfonts with preload+onload swap (never render-blocking stylesheet links), because font CSS delayed first paint on every cold visit.
- Keep the guest email-list popup unmounted from the app shell, because it read as the sign-up path and interrupted the flow; email capture stays inline in Landing forms.
- Fuse a feature header's Kreto scene banner into its FeatureWrapped panel head via featureSceneStore (header draws it only when no panel is mounted), and wrap feature bodies identically in Creator and Company mode, because separate banners duplicated the Kretopia mark and mode-specific layouts drifted from Studio.
- Keep AuthGate a pass-through (no "Sign up to unlock" overlay), because the blocking card interrupted the guest flow; sign-up lives in the navbar CTAs.
- Render Community through LegalDocumentPage and structured legal content on the existing /community-guidelines route, because all legal surfaces must stay consistent without breaking existing links.
- @username is the canonical handle: profiles.username is the single source for creator site handle AND sign-in. All validation goes through src/lib/username.ts (3–30, [a-z0-9_], no edge _, reserved list). Sign-in resolves username→email ONLY in the username-auth edge function on Lovable Cloud (legacy backend can't receive deployments); it returns session tokens, never the email, with one generic error and atomic rate limiting via consume_username_auth_attempt. The legacy DB constraint migration lives in docs/product/LEGACY_USERNAME_MIGRATION.sql until the legacy pipeline can apply it.

- @username sign-in resolves emails from the private Cloud table username_login_links (service-role only), filled by the username-auth `link` action after verifying the user's own legacy session on sign-in; the legacy service key is an optional fallback, because no legacy service_role key is available.
- Onboarding uses the shared feature header and Wrapped shell; verify the owner profile row returned by a save before navigating, and run optional enrichment after the handoff so secondary calls cannot strand a successfully saved user.
- Subscription sync validates the user server-side before calling; the function returns 401 for invalid sessions before payment work, because cached or foreign tokens do not prove account existence.
- Optional username linking validates the live app user and caches only success; failed links stay retryable.
- Use guard.ts/aiPerimeter.ts: validate the account backend without auth fallback, meter on deployment; lockdown SQL stays unapplied.
