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
- [x] Remove matching completion gates; include genuine unfinished/roleless accounts, verify three pass cycles and preserve blocks, connections and pending interests.
- [x] Use Passport HoloCard for profiles and scan/recovery states with local Kretopia identity and strong CTAs. Browser checks confirm identical 852px desktop / 792px mobile footprints, stable flip, rendered logos and no runtime errors using control data. 96 focused tests passed; production sign-in remains unavailable.
- [x] Handle existing swipes without duplicate inserts or permission changes; use portrait cards, original photos, round controls and fuller profile details. 56 tests pass; desktop/mobile inspected with control data, production authenticated verification remains unavailable.
- [x] Widen profile criteria when exact fits run out; reconsider passes only after unseen candidates, preserving blocks, connections and pending interests. Focused tests pass; production signed-in verification remains blocked below.
- [x] Reuse Scout CardShell and ScoutScanButton in Match with safe deck controls and honest scan states.
- [x] Categorize paginated Directory rails with gated profile actions; preserve accepted, received and sent interest distinctions and enhance existing Kreto arcs/rotation.
- [x] Run focused tests and responsive public browser verification without sending messages, interests or invitations.
- [ ] Verify signed-in deck and 3D rendering against production: blocked by unavailable legacy session. No official volumetric mascot asset is available; the existing procedural renderer was retained, not replaced with a rotated image.