# Feature consolidation
- [x] Restore Scout as the shared work destination, preserving existing offers and Company management.
- [x] Integrate the Passport directory into Match and preserve old links.
- [x] Update navigation and Hero; verify guest navigation on desktop/mobile without publishing.

# Events timezone fix
- [x] Save organizer-selected event times in UTC and preserve event timezone during editing.
- [x] Use UTC start/end boundaries consistently and label public event times accurately.
- [x] Verify Bali scheduling, edit round trips, and status boundaries with 78 tests; inspect a real public event on desktop/mobile. No migration or publication.
- [ ] Verify an organizer-created event against production storage: blocked by unavailable legacy authenticated session; the observed November 12 record is explicitly completed and has no timezone, requiring organizer review rather than automatic data correction.