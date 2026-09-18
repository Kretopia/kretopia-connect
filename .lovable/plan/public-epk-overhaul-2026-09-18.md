# Public EPK overhaul

## Goal
Rebuild every public Kretopia EPK as a faithful public version of the existing Passport experience, with the full creator identity, work, credentials, availability, and appropriate collaboration paths.

## Implementation
- Inventory every public EPK route and consolidate them behind one shared public Passport presentation.
- Reuse the Passport visual language, section hierarchy, Holo treatment, semantic theme tokens, and responsive behavior rather than maintaining a separate EPK design.
- Show all creator-approved public details, with safe handling for missing or private fields.
- Provide clear collaboration and contact actions using existing Kretopia flows: connection, messaging, project collaboration, public contact links, and guest conversion prompts.
- Adapt guest prompts to intent: “Join as a Creator” and “I’m a Brand — Find Creators Like [name]”, without obscuring the creator’s Passport.
- Preserve existing links, route compatibility, access rules, and production integrations.

## Validation
- Check representative public Passports as signed-out and signed-in visitors.
- Verify Dark and Light modes, mobile/tablet/desktop layouts, keyboard access, reduced motion, empty states, and long content.
- Run focused tests, all tests, type checks, production build, and security review before publishing.

## Boundaries
- No DNS, domain, payment, broad database, or access-policy changes unless a directly blocking defect is proven.
- No invented profile data and no exposure of private creator information.
- Publishing happens only after validation.
