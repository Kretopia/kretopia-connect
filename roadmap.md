# Kreto binoculars 3D
- [x] Refine the shared Match / Connected volumetric mascot against the existing binoculars pose: rounded helmet, inset visor, raised gloves, optical barrels, iridescent lenses and chest mark; shared geometry and deduplicated disposal, no generated media or relationship writes.
- [x] Verify real WebGL rendering in public Match, drag/reset at 1198×697, shared profile callback with explicit control data, and 390×844 framing; 3 geometry tests pass, build OK, no page errors or overflow. Authenticated Connected remains unverified because legacy sessions are unavailable.
- [x] Compare against the received kreto-worldwide.png top-right pose; refine helmet curvature/depth, narrower torso, longer outward legs, three-quarter default view, optical reflections and local studio environment without generated media. Three tests and real WebGL drag/reset checks pass; 1198×697, 662×697 and 390×844 render without page errors or overflow. The 3d-game verifier also reports no failed requests.
- [ ] Pixel-identical volumetric recreation remains blocked by the absence of the original 3D model: the supplied PNG establishes one view only. The current model is explicitly approximate; production Connected sessions and real-device performance remain unverified.

# Search and worldwide Match
- [x] Put Explore Kretopia first, then Roles, Users and Scouts; preserve every real result behind expansion and exact-query Scout navigation.
- [x] Consolidate Match into one scrolling rail, retain Passport flip and equal decisions, avoid stretching small portraits, rotate four 2048px Kreto poses from a native 4096px master and foreground interactive Kreto 3D.
- [x] Diversify eligible profiles across public locations and crafts without losing candidates or changing exclusions. 76 tests pass; public search, query handoff, tabs, rendered CDN art and interactive 3D verified at 1280/662/390px with no overflow or runtime errors. Local asset requests used the existing hosted asset path because localhost does not serve the asset gateway. No publication.
- [ ] Verify worldwide deck decisions and mutual matches with real production accounts: blocked by unavailable legacy authenticated sessions; public browsing and deterministic ranking tests are verified, not a signed-in production match.

# Production traction audit
- [x] Verify published data origin against the accessible read-only database and inspect its schema: production calls legacy; accessible Cloud lacks the required product tables.
- [x] Add evidence-only Traction tab to the existing Admin dashboard, with explicit unavailable metrics and no simulated charts.
- [x] Deliver reproducible SELECT queries, exclusion methodology and a timestamped CTO report; 3 tests pass, presentation and null exports verified at 390/662/1280px with no runtime errors. Actual signed-in Admin check is blocked by unavailable legacy session; no publication.
- [ ] Calculate external-only production lifetime and time-series metrics: blocked until read-only access to the published app's actual database is available.

# Hero search → Scout
- [x] Route Hero searches and old /search links to Scout with the original query; show miniature real-user matches and reuse completed searches without paid calls.
- [x] Verify targeted tests and the public desktop/mobile flow: a real UX Designer appears in the Hero dropdown and Scout; opportunity search is prefilled, old links redirect and mobile has no horizontal overflow. No publication.

# Sidebar organization
- [x] Show Creator/Company identity first, Kreto in Workspace, categories of at most three cards, and shared account controls last without adjacent dividers.
- [x] Verify both modes with 32 focused tests and successful preview compilation; no publication.
- [ ] Check the signed-in sidebar visually with production profile data: blocked by unavailable legacy authenticated session.

# Feature consolidation
- [x] Restore Scout as the shared work destination, preserving existing offers and Company management.
- [x] Integrate the Passport directory into Match and preserve old links.
- [x] Update navigation and Hero; verify guest navigation on desktop/mobile without publishing.

# Events timezone fix
- [x] Save organizer-selected event times in UTC and preserve event timezone during editing.
- [x] Use UTC start/end boundaries consistently and label public event times accurately.
- [x] Verify Bali scheduling, edit round trips, and status boundaries with 78 tests; inspect a real public event on desktop/mobile. No migration or publication.
- [ ] Verify an organizer-created event against production storage: blocked by unavailable legacy authenticated session; the observed November 12 record is explicitly completed and has no timezone, requiring organizer review rather than automatic data correction.

# Match overhaul
- [x] Restore a fixed-size Passport front/back flip with every available public profile field, equal Pass/Connect controls, reciprocal-match celebration and collaboration actions.
- [x] Make Kreto Match visibly interactive with the official animated Scout and instant local guidance, without paid AI calls. 75 tests and TypeScript pass; browser checks confirm stable card dimensions, identical buttons, working flip/modal and no mobile overflow or runtime errors using control data.
- [ ] Verify reciprocal matching, messaging and project invitation with two real production accounts: blocked by unavailable legacy authenticated sessions. No publication.
- [x] Fit the complete Match card and Pass/Connect actions within the viewport; remove the eye/profile-preview path from Match, expose every available public profile field directly, use original-resolution photos and subtle factual match reasons.
- [x] Remove the redundant empty-state copy/actions and give pending interests a branded confirmation with a Sent interests shortcut. Four viewport checks (390×667, 390×844, 662×697, 1280×900) found no page/internal overflow; original 1024×1280 image used. No publication.
- [x] Remove matching completion gates; include genuine unfinished/roleless accounts, verify three pass cycles and preserve blocks, connections and pending interests.
- [x] Use Passport HoloCard for profiles and scan/recovery states with local Kretopia identity and strong CTAs. Browser checks confirm identical 852px desktop / 792px mobile footprints, stable flip, rendered logos and no runtime errors using control data. 96 focused tests passed; production sign-in remains unavailable.
- [x] Handle existing swipes without duplicate inserts or permission changes; use portrait cards, original photos, round controls and fuller profile details. 56 tests pass; desktop/mobile inspected with control data, production authenticated verification remains unavailable.
- [x] Widen profile criteria when exact fits run out; reconsider passes only after unseen candidates, preserving blocks, connections and pending interests. Focused tests pass; production signed-in verification remains blocked below.
- [x] Reuse Scout CardShell and ScoutScanButton in Match with safe deck controls and honest scan states.
- [x] Categorize paginated Directory rails with gated profile actions; preserve accepted, received and sent interest distinctions and enhance existing Kreto arcs/rotation.
- [x] Run focused tests and responsive public browser verification without sending messages, interests or invitations.
- [ ] Verify signed-in deck and 3D rendering against production: blocked by unavailable legacy session. No official volumetric mascot asset is available; the existing procedural renderer was retained, not replaced with a rotated image.