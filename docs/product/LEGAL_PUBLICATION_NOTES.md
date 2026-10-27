# Legal pages: the designer's open points (2026-10-27)
The Terms of Service and the Privacy Policy now live at `/terms` and `/privacy` (text from `Kretopia_Terms_of_Service_2026_v6.html` and `Kretopia_Privacy_Policy_2026_v6.html`, last updated 7 October 2026). Each document carried internal notes, shown in an orange callout in the designer's file, that say it is **not ready to publish** until the points below are settled. They are not part of the legal text, so they are not drawn on the public pages and not shipped in the bundle. They are listed here so nobody forgets them.
**What the live pages cannot say yet:** who the contracting company is, its registered address, the governing law and forum, the liability cap, the consumer-law exceptions, whether customer content trains models, which cookies and analytics run, and how fast deletion really happens. The previous Terms page named none of the first four either; the Privacy Policy now removes the old fixed 30-day deletion promise on purpose (see Privacy 10).

## Terms of Service
- **Section 12, Legal review required.** The current Kretopia source set does not establish the contracting legal entity, governing law, forum, liability cap or mandatory jurisdiction-specific consumer language. These must be completed before publication.
- **Section 13, To complete before publication.** Insert the confirmed legal entity, registered address, governing law, courts or arbitration mechanism, consumer-law exceptions and any regional dispute requirements.
- **Section 15, Before publication.** Confirm that this mailbox is monitored and add the contracting entity’s legal name and registered address.

## Privacy Policy
- **Section 01, To complete before publication.** Insert Kretopia’s confirmed legal entity, registered address and any jurisdiction-specific controller or representative details.
- **Section 05, Training use is not stated here.** The supplied Kretopia materials do not establish a final policy for whether customer content is used to train general-purpose models. That point should be decided explicitly before publication rather than implied.
- **Section 08, Cookie inventory required.** The supplied materials do not establish the live cookie and analytics inventory. Do not publish a detailed cookie claim until the production site has been audited.
- **Section 10, Previous 30-day promise.** The current source set does not confirm that Kretopia can operationally guarantee deletion or anonymisation within 30 days across canonical records, backups, payment evidence and revocation propagation. The fixed promise is therefore removed pending technical and legal confirmation.
- **Section 16, Before publication.** Confirm that the privacy mailbox is monitored, add the legal entity and registered address, and determine whether Kretopia has appointed a Data Protection Officer or other required privacy representative.

## Decisions owed
1. The contracting entity, registered address, governing law, courts or arbitration, liability cap and consumer-law language (Terms 12, 13, 15; Privacy 01).
2. Whether customer content is used to train general-purpose models (Privacy 05): decide explicitly, then say it.
3. An audit of the live cookie and analytics inventory before any detailed cookie claim (Privacy 08).
4. Whether a 30-day deletion promise can be kept operationally (Privacy 10).
5. That the privacy and legal mailboxes are monitored, and whether a Data Protection Officer or other privacy representative is required (Privacy 16, Terms 15).

Once a point is settled, edit `src/content/legal/terms.ts` or `privacy.ts`; the page and its tests follow the data.
