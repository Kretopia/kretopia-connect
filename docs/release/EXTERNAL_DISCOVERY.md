# External discovery to claim loop

Branch `feat/external-discovery-claim-loop`, from `main` `acd163b7d`. Local commits only. Nothing is merged, pushed, deployed or
applied, no migration was run, no secret was set, no network call to any source was made, no paid API was called.

## What works now (manual loop)

**Ingest.** A signed-in user (rate limited, 40 a day) gives an approved URL, pasted text or a screenshot.
- Approved URL: fetched through the bounded gateway and read only from the page's own structured data (JSON-LD JobPosting or
  Event, then Open Graph). The page is never rendered or executed. Any other URL is refused ("paste the text instead").
- Pasted text / screenshot: always a PRIVATE draft. The fields are typed by the user, or read by the model only when an AI
  allowance is enabled and reserved (off by default). A named source is checked (the page's title must match), not believed:
  only a corroborated source gives the draft an identity; a screenshot with no corroborating source cannot be approved
  (also enforced by a database constraint).
- Extraction is strict: unknown stays unknown, the crawl time is never the publication date, relative or future dates are
  refused, a budget needs an ISO currency, only plain http(s) apply URLs, excerpt capped at 600 characters, markup and contact
  details (emails, phone numbers) removed, instruction-like text flagged (it blocks approval). Errors and partial results are
  recorded on the draft; a draft without a title is rejected, never saved as a success.
- Deduplication: one listing per provider id or canonical URL, atomic in the database. Fuzzy similarity only flags possible
  duplicates for the reviewer; a different role, or the same title at another employer, is never flagged.

**Review and publish.** An admin approves in `/admin/external` (only a listing with a source identity, a publisher and a
destination, and no instruction-like text). Nothing is ever published automatically.

**Claim handoff.** For an approved listing the curator COPIES a claim link (clipboard only; not shown, not stored, nothing is
sent). The token is 256-bit random, stored only as a SHA-256 hash, expires (14 days, 30 at most), works once, is bound to one
listing, 5 active links per listing. Redeeming it opens a PENDING claim and proves nothing. Ownership comes only from:
- control of the publisher's own domain: the domain is taken from the listing (never from the claimant, never a job board or
  a shared platform), proved by one exact line in `/.well-known/kretopia-claim.txt` carrying an HMAC bound to listing,
  claimant and domain; or
- an admin decision (the documented fallback when the listing has no domain of its own).
A verified owner edits three fields of their own listing (description, deadline, budget); source provenance is untouched.
Hosted applications stay OFF until an admin enables them for a verified owner; an unclaimed listing accepts none (Apply at
source opens the publisher's own page). Disputes pull a listing from the public view. Every step is in an append-only audit trail.

**Surfaces connected.** Scout cards ("External · Unclaimed"), Discover > Gigs > "Sourced" (published external gigs, their own
kind, labelled), `/listing/:id` (public page), `/claim-listing/:id/:token`, `/admin/external`, the sitemap, and the existing
`OpportunityDetail` (see SEO).

**Not connected, stated plainly.** Events and talent are supported by the data model, the validator and the markup rules
(`kind`), but there is no Events lane or talent surface for external records, and Match does not read them: no external
creator is shown anywhere. Shortlists are untouched (they hold only what a user saved). Screenshot OCR is not a new path: a
screenshot is read only when AI reading is enabled; otherwise the user types the fields. The "existing verified publisher
account" verification route is not implemented (domain control and admin review are).

## Secure fetch path (reused and hardened)

`_shared/ssrf.ts` already blocked private addresses and re-checked redirects. `safeFetchBounded` adds: an approved-host list,
HTTPS only, port 443 only, no credentials in the URL, a MIME allowlist, a hard size cap (declared and streamed), a timeout,
per-hop re-validation of everything, fail-closed DNS (unresolvable, or any internal answer, is refused), plus the
benchmarking and site-local ranges. Model-proposed URLs never reach it. Known limit: `fetch()` resolves again when it
connects, so DNS rebinding cannot be pinned from this runtime; the approved-host list is what bounds it, and the policy must
not be used for untrusted callers without `allowedHosts`.
The model call carries no tools, functions or secrets, wraps the text in the existing isolation delimiters, is capped in size,
and its answer is validated like any untrusted input. Permissions are enforced outside the model.

## SEO

Found and fixed: `OpportunityDetail` emitted JobPosting for every gig with Kretopia as `hiringOrganization`, `created_at` as
`datePosted` and a hard-coded USD salary, and was always indexable. Now:
- indexable only with 200+ characters of permitted content, a publisher, a destination, a public published/claimed status;
  drafts, private, flagged, thin and expired listings are noindex and out of the sitemap;
- JobPosting only on an individual gig page: for an external listing only when CLAIMED with the owner's full description and a
  real posting date; for a native gig only when posted by an employer that names its organization, never for a scouted gig,
  no salary unless structured, no `directApply` unless hosted applications are enabled; none for talent or event pages;
- canonical is the ORIGINAL source for an unclaimed import, the page itself only for a verified owner's listing;
- closed or past-deadline gigs lose markup and sitemap state on the same rule that makes them noindex;
- event markup only with a name, a start and a place. No promise of indexing, ranking or AI citations.

## Reused

Search gateway: none was added (the existing public-web-search gateway is untouched). Reused: `ssrf.ts`, Scout's feed parsers
(`scoutSources.ts`), `promptIsolation.ts`, `aiRateLimit.ts` (atomic since the quota migration), `admin-guard.ts`,
`require-user.ts`, `aiModels.ts`, `FeaturePageHeader`, `StudioFeatureShell`, `Button`, the toast, `routePrefetch`.
The existing scouted gig and event claim RPCs and `ClaimGig` are unchanged. NOTE: they treat possession of the token as
ownership (the claimant becomes the owner on redemption). The new loop is stricter by design; aligning the old one is a
decision for you, not changed here.

## Bounded automation (implemented, disabled)

`external-discovery-run` (admin or cron only) reuses the same adapters, validation and dedupe. Controls: a global kill switch
(off), a per-source enable that refuses an unknown cost, a per-source run lock (30 simultaneous attempts start 1), the
CONFIGURED price, the budget RESERVED before the first fetch (refused: nothing is fetched), settled at real usage, abandoned
reservations expire but stay counted until reconciled, idempotent job keys, a single attempt per run (no retry loop), three
failures in a row switch the source off (dead letter), every result is a private DRAFT. No schedule is created by this
change. Not implemented: a company-level limit (the ledger has global, source and user scopes), an in-run cache.

## Tests

| Area | Where | Result |
|---|---|---|
| Gateway (private IPs, DNS, redirects per hop, scheme, port, credentials, MIME, size, timeout) | `ssrfPolicy.test.ts` | 17, mutation-checked |
| Identity, sources, extraction, injection, redaction, similarity | `discovery/*.test.ts` | 70+, mutation-checked |
| Pipeline: private-IP/redirect blocked, prompt injection (no tools, no secrets, reserved allowance), malformed extraction, concurrent import (20 -> 1), claim link alone grants nothing, expired / replayed / cross-object / cross-user, body owner id ignored, another publisher refused, unclaimed accepts no applications, run reserves first / lock / dead letter | `discovery/pipeline.test.ts` | 35, five invariants mutation-checked |
| Edge handlers (auth, admin vs cron, rate limits, public preview) | `edge/externalDiscoveryFunctions.test.ts` | 11 |
| Pages and list | `ExternalListing`, `ClaimListing`, `AdminExternal`, `PublishedExternalListings` | 28 |
| Existing pages wired to the rules | `discovery/frontendWiring.test.ts` | 6 |
| SQL on a real Postgres 16 (throwaway, local) | see below | run, not committed as a test |

SQL rehearsal (throwaway local Postgres 16, nothing production): the migration applies and re-applies; 40 concurrent imports of
one posting give 1 row (40 different give 40; a re-import never overwrites content); 40 simultaneous redemptions of one link
open 1 claim; 3 claimants verifying at once (30 clients) give 1 owner; 40 parallel reservations against a 50-cent source cap
give 5; one user against a 30-cent cap gives 3; 30 calls with one job key give 1 reservation; settling returns the unused part;
an abandoned reservation stays counted; 30 run attempts on one source start 1; the third failure disables the source; clients
cannot read any table or run any function, only the public view.

## Exact missing credentials and secrets (names only, none set)

- `CLAIM_CHALLENGE_SECRET`: required for domain verification. Without it only the admin review route is offered.
- `EXTERNAL_AI_EXTRACTION=1` and the existing `LOVABLE_API_KEY`: required for model reading of text and screenshots. Without
  them the user types the fields. Also needs an enabled `manual-ai` source row with a known cost.
- `FIRECRAWL_API_KEY` (or another search provider): required for any search-based discovery. That adapter (`web-search`) is
  listed with an unknown cost and cannot be enabled. No live search discovery exists until a provider, its price and the terms
  of the result sites are approved.
- `PUBLIC_SITE_URL`: optional (defaults to https://www.kretopia.com).

## Draft migration (not applied)

`supabase/migrations/20261029100000_external_discovery.sql`: purely additive (new tables, one view, 17 service-role-only
functions); nothing existing is altered, so it is safe to apply before the code ships. Tables: `external_listings`,
`external_listing_claim_tokens`, `external_listing_claims`, `external_listing_events`, `discovery_settings`,
`discovery_sources`, `discovery_spend_counters`, `discovery_spend_ledger`; view `public_external_listings`. A rollback block is
at the bottom of the file. As with the quota and credit migrations, I will prepare a guarded, rehearsed paste script when you
approve it.

## Source permissions

Four public feeds are listed as approved adapters (Remote OK, We Work Remotely, Jobicy, Arbeitnow): public APIs or RSS,
link back to the original, name the source, keep an excerpt only. This relies on the repository's existing note on their
terms (`scoutSources.ts`); I did not re-read the sites' terms in this pass, so confirm them before enabling a source.
Remotive stays excluded (its terms forbid showing its jobs behind a sign-up wall). Every adapter ships disabled.

## Cost ceilings (decisions owed, all default to zero so nothing can spend)

`discovery_settings.daily_ceiling_cents` and `per_user_daily_cents`, `discovery_sources.daily_budget_cents` and
`max_fetches_per_run`. The four feeds cost 0 per call. `AI_EXTRACTION_CENTS = 2` in `pipeline.ts` is MY ESTIMATE of one model
reading, not a price: confirm the gateway's real cost and change it before enabling `manual-ai`.

## Activation order (each step needs your approval; none done)

1. Apply the migration (additive). 2. Paste the edge functions: shared files first (`_shared/ssrf.ts`, `_shared/discovery/*`,
   confirm `_shared/require-user.ts`, `_shared/aiRateLimit.ts`, `_shared/scoutSources.ts`, `_shared/promptIsolation.ts`,
   `_shared/aiModels.ts` exist in `kretopia-app`), then `external-import`, `external-claim`, `external-discovery-run`,
   `generate-sitemap`. 3. Publish the frontend. 4. Set `CLAIM_CHALLENGE_SECRET`. 5. Manual use first: import, review, publish, one
   claim link to a publisher you know. 6. Only then, optionally: set the cost ceilings, enable one free feed source, switch the
   kill switch on, run `external-discovery-run` by hand and read the drafts. 7. A schedule is a separate approval: one daily
   cron call to `external-discovery-run` with the existing `x-cron-secret` header, created by a person, after step 6.
   No SQL for steps 6 and 7 is in this document on purpose (a pasted proposal has broken production before).

## Rollback

Frontend: republish the previous version. Edge functions: paste the previous copies (`generate-sitemap`, `ssrf.ts` are the only
changed existing ones; the three new functions can simply be left undeployed). Database: the rollback block in the migration
drops only what it added. Turning the kill switch off, or disabling a source, stops all automated work immediately.

## First manual use (2026-10-28) and what it fixed

Migration, functions, sitemap and frontend were live; automation stayed off (no source enabled, kill switch off). As the signed-in
admin I imported one real Remote OK posting, approved it, copied a claim link and followed it. The loop worked end to end:
public listing and `Sourced` lane labelled External and Unclaimed, canonical = the source, no `JobPosting` markup, anonymous
reads limited to the public view (base table 401), claim preview exposing only title/publisher/kind/claimed, redeem and edit
refused without a user, owner controls absent before and after "Start", the token gone from the address bar after "Start",
reuse of the link refused (410). I used the admin account as claimant (no second account), then rejected that test claim.

Five defects, fixed in the follow-up PR (no migration, no new dependency):

1. **A fresh import was invisible.** `/admin/external` listed only in-review, published and claimed listings, while an import
   is a private `draft`. The page now also reads the caller's own drafts (`list_mine`), shows them under "Your drafts" with what
   was left unknown, and offers "Send to review", "Approve and publish" and "Reject".
2. **"Anywhere, Anywhere, Anywhere".** The source repeats one word in every address field; the extractor now says it once
   (case-insensitive), real addresses keep every part.
3. **"Deadline" was the posting's `validThrough`.** schema.org defines it as when the posting stops being valid, not an
   application deadline. It stays in `deadline_at` (the public view hides a listing after it, and a claimed listing's JSON-LD
   uses it as `validThrough`), but the page now says "Listed until". No data change.
4. **A stated salary was dropped silently.** `baseSalary` (min/max/single amount, currency, period) is now read as the structured
   budget and validated by `parseExtraction`; a salary the page states but not usably is reported under "Left unknown" (no
   currency, no amount, range backwards), never guessed. The page shows it as "Pay stated at the source" with grouped digits.
5. **The same posting sat in two lanes.** The duplicate advice also looks at members' Scouted lists (candidates only: the
   provider id inside the address, or the same title) and records ONE aggregate entry with a member count; no row or member id is
   stored with the listing. Advice only: nothing is merged, hidden or blocked, and a failed lookup never blocks an import.

Replaying the real saved page through the fixed extractor gives location `Anywhere`, USD 80,000 to 155,000 per year, no issues.
The one live row was imported before the fix and still reads "Anywhere, Anywhere, Anywhere" with no pay: after the edge files are
pasted and deployed, "Remove" it in `/admin/external` and import the same address again (a removed listing frees its identity).
Not changed: the scheduled run's feed imports do not compute duplicate advice; a board posting still offers curator review only
(no publisher domain to prove).

## Feed drafts: reading what the scheduled run finds

The scheduled run imports postings as private drafts with no owner (`created_by` null). They were in no person's "Your drafts" and
in no review queue, so a run would have created up to 100 drafts nobody could see. And a rejected or removed listing frees its
identity in the database (on purpose, so a person can import it again), which would have let every run recreate what a curator
rejected.

- `external-import` has one more admin-only action, `list_feed_drafts` (the cron secret and ordinary users are refused): the newest
  100 drafts nobody owns, with the total. It changes nothing.
- `/admin/external` shows them under "Feed drafts (N)": 25 at a time, with Send to review, Approve and publish, and Reject on each,
  and a note when more exist than were loaded.
- The run now leaves out any posting whose identity belongs to a rejected or removed listing (`skippedDecided` in its report).
  A person can still import such a posting on purpose.
- The run still computes no Scouted-overlap advice for feed drafts (that lookup is per posting); the advice exists for manual imports.
- Deploy: `_shared/discovery/pipeline.ts` and `external-import` (and `external-discovery-run`, which imports the same pipeline), then
  publish the frontend. No migration.

## Older scouted claim links: a link is a request, not ownership

`claim_scouted_opportunity(token)` and `claim_scouted_event(token)` (20261009*) set `created_by = auth.uid()` and
`claim_status = 'claimed'` for ANY signed-in caller holding the token. The token is a share link (the scout hands it to the
publisher), so a link that is forwarded, pasted or screenshotted made whoever opened it the owner: edit rights, applicants and
the "claimed" label. The external loop already works the other way; the older flows now match it.

- `20261029110000_scouted_claim_requests.sql` (additive, safe before the frontend): table `scouted_claim_requests` (server-only),
  `request_scouted_claim(kind, token)` (opens a pending request, changes no owner, one open request per person and target, at most
  five open per person), `list_scouted_claim_requests()` and `decide_scouted_claim(request, decision)` (curators only, through
  `external_is_admin`). Approving is the ONLY path that sets `created_by`, as a compare-and-swap on "still unclaimed", and it
  closes the other open requests for that target.
- `20261029110100_scouted_claim_close_token_ownership.sql` (APPLY ONLY AFTER the frontend is published): the two old functions keep
  their name, signature and grants but answer `verification_required` and change nothing.
- Frontend: `/claim-gig/:token` and `/claim-event/:token` ask, then say "Request received... you become its owner only when they
  approve"; the false "gig claimed" notification to the scout and the jump into the gig or backstage are gone. `/admin/external`
  lists the requests with "Approve as owner" and "Decline request".
- Rehearsed on a throwaway Postgres 16 with stub tables: a request changes nothing, a repeat is the same request, refusals (kind,
  token, unknown, already claimed, wrong kind), signed-out and anonymous refused, five-open cap, a member can neither list, decide,
  read nor write, approve moves ownership and closes the other requests, no second decision, reject changes nothing, an event
  claimed meanwhile is not taken, and 40 concurrent rounds of two curators approving two requests for one target ended with one
  approved, one rejected, no error. After the second migration the old functions change nothing. A deadlock with a different lock
  order was suspected but could not be reproduced, so the target-first order is a precaution, not a proven fix.
- Order: (1) apply the first migration through a guarded paste script (to be prepared on approval), (2) merge and publish the
  frontend, (3) apply the second migration. Applying the second early makes the OLD claim pages say "Couldn't claim".
- Not covered: links already shared keep working as REQUESTS; nothing is revoked. Who may be approved is a curator judgment
  (the page tells them holding the link proves nothing); there is no automatic domain proof for these older rows.

## Offers in the Match deck, and the Company-only lanes

Decisions (2026-10-28): offers found outside Kretopia go into the Swipe deck; events and creatives found outside Kretopia have a lane
ONLY in Company mode, in Discover and in the Studio's workspace actions.

**Match deck** (`MatchDeck`, used by Discover, Match and Circle; `SwipeFeature` takes an `offers` switch, off by default):
- A creator account sees published external GIGS between the people: one comes up after every 4 people answered, and on its own once
  no people are left (not hidden behind "All caught up"). A company account keeps people only, and nobody sees one while the account mode
  is still being read. The order rule is pure (`lib/swipeDeck.ts`).
- An offer card says External / Unclaimed (or Claimed), where it came from and when it was last checked, and that Kretopia is not the
  publisher and **sends nothing**. Pass (left), Interested (right), arrow keys and drag work like a person's card. "Open at source" is
  a plain link in a new tab and answers nothing; "Interested" opens nothing by itself (a toast offers "Open").
- An answer is ONE row in `swipes` written by the member's own session: `target_type = 'opportunity'`, `target_id` = the listing's id.
  No notification, no function call, no match, no connection, no application (a test reads the code to keep it that way). Undo takes
  an offer back and restores the counter so it is the next card again. A write that fails still removes the card for the session.
- The gigs lane in Discover marks the gigs a member kept with "Kept".
- **To confirm in production (read-only):** `security/verify-swipes-opportunity-2026-10-29.sql` shows the CHECK on `swipes.target_type`,
  the keys, the policies and any trigger. The first migration allows 'opportunity'; a later one declares a different list, so production
  must be read, not assumed. If 'opportunity' is refused, the deck still works but answers are not remembered: a migration is then needed.

**Company-only lanes:** Discover > People gets "Sourced" (creatives), Discover > Events gets "On Kretopia | Sourced". The Studio's
Company workspace actions get "Sourced creatives" and "Sourced events", which open those lanes (`?tab=people|events&mode=sourced`, used
once and then removed). A creator's Discover is exactly what it was.
- **These lanes are empty today:** every approved source is a gig source, and a pasted creative or event cannot become public without a
  corroborating approved source. They fill when a source for events or creatives is approved (a decision with a cost and a terms check).
  Until then they say so plainly. Creatives are people: nothing is sent to them from these lanes.

## Owner controls after a curator's decision (found by the second-account test, 2026-10-29)

**The gap.** A claimant who asked for a review and was approved had nowhere to go: the only route was `/claim-listing/:id/:token`, the
link leaves the address bar once used, a reload of `/claim-listing/:id` fell through to the home page, and the owner controls existed only
inside the page session that had proved the claim (`verified` was set by a domain-proof success, never by the server's state). The server
side was right (`owner_update_external_listing` works for the verified owner and refuses everyone else; the admin account, which is not the
owner, got `403 forbidden` and the deadline did not move), so this was a missing door, not a hole.

**The fix** (frontend + `external-claim` + `_shared/discovery/pipeline.ts`, no migration):
- New `external-claim` action `status` (signed-in only, after the sign-in guard): `claimStatus(deps, userId, listingId)` answers about the
  CALLER only (the id is the session's; a static test refuses any user or owner id read from the body). It returns `owner` (the listing is
  `claimed` and `owner_user_id` is the caller), `claim` (`verified` for the owner, otherwise the caller's own `pending` or `rejected`, else
  `none`), the caller's OWN claim id while it is pending, and, for the owner only, the three editable values plus the title and publisher.
  Another person's claim or owner is never returned, a verified claim on a listing that is no longer claimed is not a standing, a reported
  ("disputed") listing keeps its owner as the owner, and a private or unknown listing is `not_found` for someone with no part in it.
- New route `/claim-listing/:id` (sign-in required, same page). Without a link the page asks `status` and shows exactly one of: the owner
  controls (filled with what the listing has; Save sends only what changed, and "Nothing to save" when nothing did), the SAME verification
  choices as right after "Start verification" for a claim that is started but undecided (proof line for the publisher's domain when there is
  one, and "Request a review"; it never claims a review was requested, because that is not stored on the claim, and asking twice is harmless),
  "A curator reviewed your claim and did not approve it", or "You do not manage this listing". Only a successful answer can say that last
  one: a lookup that fails says "We could not check your access ... Reload", so an owner on a bad connection (or before the function is
  deployed) is never told they manage nothing. After "Request a review" the page says to come back to this page. While it asks there is a
  loader and nothing to click. With a link the page is exactly what it was (the existing tests
  that pin it are untouched).
- `/listing/:id` shows "Manage this listing" to the signed-in verified owner of a CLAIMED listing, and asks nobody else (a guest or an unclaimed
  listing never triggers the call; a failed answer shows no link).

**To ship:** copy `supabase/functions/_shared/discovery/pipeline.ts` and `supabase/functions/external-claim/index.ts` into kretopia-app and
deploy `external-claim` (pipeline.ts first; `external-import` and `external-discovery-run` import the same file and need no change but keep the
same copy), then publish the frontend. Until the function is deployed the new page answers "We could not check your access" to everyone (the
`status` call is refused as an unknown action), which is safe but hides the controls.

**Positive test of the owner path without the UI (server side, 2026-10-29):** the second account calls `owner_update` for the claimed
listing from its own session; the server must answer `200 {"ok":true}` and change only the deadline. The same call by any other account
answers `403`.

## Opening the other three feeds (applied 2026-10-29)

**State read from production (read-only, 2026-10-29):** kill switch on, both ceilings 0, Jobicy the only enabled source (last run 2026-10-28 16:57 UTC, one fetch), 16 published + 30 private feed drafts from Jobicy, plus the Remote OK posting BlueTuskr. Scout already reads all four feeds for its own private, per-member results; this section is about the curated public layer (Discover Gigs > Sourced, the Match deck, `/listing/:id`).

**What is prepared (untracked, `security/`):** `apply-open-feeds-2026-10-29.sql` and `rollback-open-feeds-2026-10-29.sql`. The apply script opens Remote OK, We Work Remotely (its first feed, design) and Arbeitnow, each free (cost 0, no budget, one fetch per run); Jobicy is not touched and no schedule is created. The list of sources is a table at the top of the script: delete a line to leave that source off. The preflight refuses unless the kill switch is on, both ceilings are 0, Jobicy is the only enabled source and the list holds only approved ids; a smoke test per source (lock, zero-cost reservation, one cent refused, AI reading refused, a feed import is a private draft) rolls everything back on any surprise. Rehearsed 37/37 on a throwaway Postgres 16 that went through the real migration and the real "automation on" script (apply, repeat, rollback, re-apply, nine preflight refusals, six injected failures, a shorter list, a dead-lettered source reset, real roles locked out). Expected result row: `t|t|t|t|t|t|t|t|0`.

**Terms, as read on 2026-10-29:**
- Remote OK (the API's own notice): "link back (with follow, and without nofollow!) to the URL on Remote OK and mention Remote OK as a source", or API access is suspended; no logo. The listing page, the Match offer card and the Sourced lane carried nofollow for every source; `sourceLinkRel` now leaves Remote OK's link followed and keeps nofollow for the others.
- Arbeitnow (API notice + terms of service): free, "please do not abuse", jobs refresh hourly; section 11 asks for a link back to Arbeitnow.com. Section 2 forbids "any public display" of "materials on the website" and does not say whether API data is covered: unresolved, so no Arbeitnow listing should be published until you decide.
- We Work Remotely: the feed page sits behind a bot challenge and could not be read (not bypassed). Read https://weworkremotely.com/remote-job-rss-feed before publishing any of its listings.
- Jobicy: unchanged (credit to Jobicy, link to its own job page, poll at most once an hour). Its marketing feed and WWR's marketing feed are NOT opened: more noise, and a second Jobicy call per run is a stricter reading of "once an hour" than needed.

**What to expect (dry run of the real feeds through our parsers):** Remote OK 99 postings, mostly engineering and sales (its tags are loose: `?tag=design` returns "Senior Software Engineer"); We Work Remotely design 23; Arbeitnow 300 per page of which the run imports the first 100, mostly German-language, about one in eight creative. The gain is a few dozen more creative gigs, not hundreds, and every one still needs a human decision. None of the four feeds lists events or talent, so the Company-only events and talent lanes stay empty until a source for them is approved.

**Publishing stays a decision per listing:** the imports are private drafts; the Feed drafts panel lists them; approving one makes it public.

**Reliability fix found on the way:** the contact-redaction patterns were quadratic on a long unbroken run of letters or digits (40,000 characters: about 3 s; 100,000: about 17 s), enough to stall a run and, after three failures, switch a source off. Bounded now (`extract.ts`, tested). It reaches production only when `_shared/discovery/extract.ts` is copied into kretopia-app and external-import / external-discovery-run are redeployed. The tag, comment and script patterns have the same shape on adversarial markup repeated tens of thousands of times: not changed.

**Order:** merge and publish the frontend (the followed Remote OK link) -> copy `extract.ts` and redeploy the two functions -> apply the SQL -> one manual `external-discovery-run` per source (Jobicy at least an hour after its last run) -> read the drafts -> publish the ones you approve.

## The public view was writable by clients (found and closed 2026-10-29)

**What it was.** `public.public_external_listings` runs with its owner's rights (the base table is service-role only, so it must) and is a plain single-table view, which Postgres treats as auto-updatable: an INSERT, UPDATE or DELETE on the view is applied to the base table with the OWNER's rights. The first migration ended with `REVOKE ALL ... FROM PUBLIC`, which does not remove the privileges Supabase's default privileges had already granted to `anon` and `authenticated` by name (ACL `anon=arwdDxtm`, `authenticated=arwdDxtm`). With only the public key, anyone could change or delete a published listing (for example point its `apply_url` elsewhere) and insert rows into `external_listings`. The rehearsals of the migration checked reading and the base tables' revokes and never a write through the view; that is how it was missed.

**Confirmed against production with zero-row requests only:** `PATCH` and `DELETE` on the view with the public key answered 204, and a `POST` reached the base table's NOT NULL check. A read-only audit of every view in `public` found this the only one open: all the others carry `security_invoker=true`, so their writes are checked against their own base tables as the caller. Signs of use in the data: 278 listings, every one with an audit event, no published listing changed after its last audit event, all 44 public `apply_url`s on jobicy.com or remoteok.com. That is what the data shows, not proof for the past.

**Fix.** `supabase/migrations/20261029120000_close_public_view_writes.sql` revokes everything from `PUBLIC, anon, authenticated`, grants clients `SELECT` only, keeps `service_role`, and turns on `security_barrier` so a client filter cannot be evaluated against rows the view excludes (drafts, private, flagged). Paste script: `security/apply-close-view-writes-2026-10-29.sql` (untracked), rehearsed 29/29 on a throwaway Postgres 16 with Supabase-style default privileges: the hole reproduced first (anon defaces, deletes, inserts), then closed for `anon` and `authenticated`, reading kept, `service_role` kept, idempotent, same ACL as the migration, four injected failures roll back. No undo script on purpose: if reads ever fail, `GRANT SELECT ON public.public_external_listings TO anon, authenticated;` is the whole repair.

**Applied 2026-10-29** (PR 287 merged; the paste script's result row was all true with 44 public rows). Checked from outside with the public key, with zero-row filters: reading answers 200/206 (44 rows), `PATCH` and `DELETE` now answer 401 `permission denied for view public_external_listings` (they answered 204 before).

## Expiry: a gig stops being public 30 days after its source date (applied 2026-10-29)

**Rule (your decision, 2026-10-29):** each listing expires 30 days after the date its source published it. It is applied in the one view every public reader goes through (the listing page, the Sourced lane, the Match deck, the sitemap), so it needs no schedule and applies everywhere at once. `public_external_listings` hides a listing of kind `gig` that is not claimed when `coalesce(source_published_at, created_at)` is 30 days old or older (exactly 30 days is already expired; `created_at`, the day Kretopia first saw it, only stands in when the source stated no date). Events keep their own dates (`ends_at`), talent has none, a claimed listing is managed by its owner, and the existing deadline rule is unchanged. Nothing is deleted or re-labelled: a hidden listing keeps `status = 'published'`; a curator who wants one public again can re-import it, which starts a new date. Arbeitnow's own terms remove a posting after 30 days, so the two agree.

**Prepared:** `supabase/migrations/20261029130000_expire_stale_external_gigs.sql`; paste scripts `security/apply-expire-stale-gigs-2026-10-29.sql` and `security/rollback-expire-stale-gigs-2026-10-29.sql` (untracked). The apply script refuses unless clients can no longer write through the view (run the view-write fix first), announces in its preflight how many public gigs the rule hides at once, proves each case on synthetic rows inside a rolled-back sub-transaction (10 days visible, 31 hidden, exactly 30 hidden, undated and new visible, undated and 40 days old hidden, claimed visible however old, an old event visible, flagged and past-deadline still hidden) and checks that the number hidden equals the number announced. Rehearsed 27/27 on a throwaway Postgres 16. The migration re-asserts clients SELECT only and `security_barrier`, so replacing the view can never reopen the write hole. Expected result row: `t|t|t|t|t|t|<public rows now>|<hidden now>`.

**Applied 2026-10-29** (PR 288 merged; result row all true, 44 public rows, 0 hidden). The production view definition now carries the rule, `security_barrier` is on and `anon` / `authenticated` hold `SELECT` only. The oldest public gig is dated 2026-10-09, so the first gigs drop out around 2026-11-08. The script must be pasted into the SQL editor of the kretopia-app project (the one that reaches production); pasted into Kretopia Connect it stops at its preflight (that database holds no external listings) and changes nothing.

## Himalayas, a fifth free source (prepared 2026-10-29, not applied)

**Decision (2026-10-29):** new free sources were approved. Himalayas is added. Working Nomads is not (no documented API terms, and about 3 creative roles in its 41 current jobs); an events source is not (no keyless free feed with permissive terms was found; Ticketmaster needs a key and its commercial-use terms are unread). Neither is wired; both need your word before anything is added.

**Terms, as read on 2026-10-29 (https://himalayas.app/docs/remote-jobs-api):** free, no key; credit Himalayas with a visible link; every apply action goes to the job's own Himalayas page (`applicationLink`, which carries `utm_source=api`); show the jobs only on sites you operate; remove a job once it expires; never pass them on to other job boards, aggregators, Google Jobs or LinkedIn (so no `JobPosting` data: an unclaimed listing already has none); the feed refreshes daily, so poll at most once a day.

**What was built.** Registry: `himalayas` with eight tested search queries (video editor, motion designer, art director, photographer, illustrator, copywriter, content creator, designer; each answers at most 20 jobs, sorted by recency), off by default, cost 0. Parser (`parseHimalayas`): a job without its own Himalayas page is skipped; only the short `excerpt` is kept (capped at 900 characters), never the description; a list of more than four countries is printed as "N countries", none at all is unknown (not "worldwide"); the source's own `expiryDate` becomes the deadline, so once a curator publishes a job the public view hides it the moment Himalayas stops listing it; a pay range is kept only when the source states numbers with a three-letter currency code and a known period. Identity: `himalayas:<company>/<slug>`, so the same job returned by two queries is one listing. Links: the listing page, the Sourced lane and the Match card credit it ("via Himalayas") and open `applicationLink` with `utm_source=api` put back (our canonicalisation strips it for deduplication), nofollow like every source except Remote OK.

**Two pipeline fixes found on the way.** (1) A feed import dropped the deadline and the pay range even when the source gave them (only manual imports carried them); the feed import now passes `deadline_at`, `deadline_tz` and `budget` to `import_external_listing`, which already stored them. (2) A source with several queries concatenated every query's results and cut the list at 100 BEFORE removing repeats, so overlapping queries would have pushed the last queries out of the run unread; the bound now counts distinct jobs.

**Prepared (untracked, `security/`):** `apply-open-himalayas-2026-10-29.sql` and `rollback-open-himalayas-2026-10-29.sql`. The apply script opens only the himalayas row, free, 8 fetches per run (lower the number in the list to read only the first N queries); every other source row is left byte for byte as it is, whether or not the three other feeds are open. The preflight refuses unless the kill switch is on, both ceilings are 0, Jobicy is an enabled free source and every other enabled source is one of the approved free feeds. The smoke test (rolled back) takes the lock, reserves and settles at zero cost, refuses one cent, refuses AI reading and an unopened source, imports a Himalayas draft that keeps its expiry date and pay range, refuses to import it twice, and checks that once published it leaves the public view at its deadline. Rehearsed 61/61 on a throwaway Postgres 16 (only Jobicy open, the production state with the other feeds open, and with both public-view migrations applied; apply, repeat, rollback, re-apply, twelve preflight refusals, eleven injected failures, a lower number of fetches, a dead-lettered row reset, real roles locked out). Expected result row: `t|t|t|t|t|t|t|t|<feed drafts now>`.

**Order:** merge and publish the frontend (credit and `utm_source=api` link) -> copy `_shared/discovery/{feeds,candidate,canonical,sources,pipeline}.ts` into kretopia-app and redeploy `external-discovery-run`, `external-import` and `external-claim` (all three import the pipeline; `labels.ts` is frontend only) -> apply the SQL -> ONE manual `external-discovery-run` (not more than once a day) -> read the drafts -> publish the ones you approve. If the SQL is applied before the functions are redeployed, the old registry does not know `himalayas` and the run skips it: harmless, but nothing is read.

**Not exercised live:** the eight queries were not all fetched (the API asks for one poll a day, and the first admin run should be the first full read); the fixture is a trimmed copy of one real answer, so the number of creative jobs per run is unknown until then.

## Terms of the five feeds (read 2026-10-29) and what is published

This is a reading of the published terms, not legal advice; nothing here certifies that a use is lawful. It supersedes the terms notes in the sections above.

- **Remote OK** (its own API notice): a link back WITH follow and a mention of Remote OK, no logo. Done: its link is followed and the name is shown.
- **Jobicy**: credit to Jobicy and a link to its own job page; poll at most once an hour. Done.
- **Himalayas** (https://himalayas.app/docs/remote-jobs-api): visible credit with a link; every apply action on the job's own Himalayas page (`applicationLink`, with `utm_source=api`); show the jobs only on sites you operate; remove a job once it expires; never pass them to other boards or aggregators; the feed refreshes daily, so poll at most once a day. Coded as described above.
- **Arbeitnow** (terms of service): section 2.1.2 forbids using "the materials" for "any public display (commercial or non-commercial)" and 2.1.5 forbids "mirror"-ing them; section 11 (API) asks for a link back to Arbeitnow.com and reserves the right to revoke the permission at any time. Nothing says the API is exempt from section 2. **No Arbeitnow listing is published.**
- **We Work Remotely**: its RSS page says the feed is open to anyone who credits We Work Remotely. Its separate "Terms & Guidelines" page (https://weworkremotely.com/api-terms-and-guidelines; the site sits behind a bot challenge, so it was seen only through a search summary of the official page) says applying must be routed through weworkremotely.com, bars a "job advertising or job search service", and bars scraping, copying, saving or storing its data. It is not clear whether that page covers the RSS feeds. The contact it names is hello@weworkremotely.com. **No We Work Remotely listing is published.**

**Decision (2026-10-29):** nothing from Arbeitnow or We Work Remotely is published; their 123 private drafts remain drafts. The optional `security/close-weworkremotely-arbeitnow-2026-10-29.sql` (untracked, rehearsed 9/9) closes the two sources without deleting any draft. Publishing anything from them needs their written permission first. Scout already reads these feeds for each member's own private results; the same question applies to it and is not addressed here.

**Not added:** Working Nomads (no documented API terms found, and about 3 creative roles among its 41 current jobs) and an events source (no keyless, free feed with clear terms found; Ticketmaster needs a key and its commercial-use terms are unread). Either needs your word and a read of its terms first.

## Scout: the All sources tab (2026-10-29)

**What it is.** A fourth tab in Scout, right after For You, that lists every opportunity Kretopia can show from every source, sorted into fields. It reads two things and nothing else: the reviewed gigs found outside Kretopia (the public view `public_external_listings`, kind gig, up to 1000) and the open gigs posted on Kretopia. It adds no table, no function and no migration; whatever is public appears, and nothing private can.

**How it sorts.** `src/lib/opportunityTaxonomy.ts`, pure and without AI: seventeen fields (ten creative: creative direction, design & brand, product & UX, video & motion, photography, illustration & art, games & 3D, audio & music, writing & content, social & community; then marketing, engineering, data & AI, product & project management, sales, operations/finance/people, everything else), a level (intern to director), a working mode and a language. Each rule names a field and how plainly it names the job; the strongest title match wins, the excerpt only decides when the title names nothing and the excerpt names the job outright, and a posting that names two crafts ("Graphic Designer & Video Editor") is listed under the first and found under both. Accents are ignored, so Spanish, Portuguese, French, Italian and German titles of the main crafts sort too. Titles are cleaned (entities and double-encoded text repaired, emoji and "(remote)" / "(m/f/d)" dropped, shouted capitals set in normal case); a long list of places is cut to two and a count; one job posted for several places by one company on one source is one card that lists the other places with their own links.

**What it shows.** Counts next to every filter (each computed with the other filters applied), search across title, company, every place, source and field, filters for source, working mode, level, language, freshness and "pay listed" (only offered when it would separate something). A creative field always shows every match; a field outside the creative ones shows its first six until it is opened, unless the person is searching or filtering. A pay line exists only when the source stated a range with a currency code and a period. Links follow each source's terms (Remote OK followed, Himalayas with `utm_source=api`, the rest nofollow).

**What it does not do.** It does not publish anything. It is as full as the number of reviewed listings: on 2026-10-29 that is 44 public gigs plus the open Kretopia gigs, and it grows when a curator publishes drafts. Nothing from Arbeitnow or We Work Remotely appears while their listings stay unpublished.

## Three limits of the daily run, removed (2026-10-30)

The first two daily runs showed three limits. All three are in `_shared/discovery` and the `external-discovery-run` function: no migration, no frontend change.

**1. The cap hid what it cut.** A run took at most 100 DISTINCT postings from a source, and both Himalayas runs imported plus recognised exactly 100: on a busy day the last queries' postings would never have been looked at, and nothing said so. Now the cap is per source (`maxCandidatesPerRun` in the registry): Himalayas has 200, room for the 160 postings of its eight full pages; every other source keeps 100. The cap counts distinct postings across all of a source's feeds, a feed is no longer cut while it is parsed, `fetched` is the real number read, and a run that leaves postings out says how many in `cut` (absent means none).

**2. Nothing took down a posting the source had closed.** Himalayas' docs say to "re-read the feed daily and drop jobs that are no longer in it". The feed only shows the newest postings of each query, so a posting missing from it is not necessarily closed. Instead, after reading the feed, the run asks Himalayas about each PUBLISHED posting the read did not show, through its documented single-job address (`https://himalayas.app/jobs/api/companies/<company>/jobs/<slug>`): 200 open, 410 closed ("remove it"), 404 not in the API; answers are cached 10 minutes and the unkeyed allowance is 60 a minute. Rules, all tested: only a 410 or a 404 takes a posting down (status `expired`, private, the state a curator's "expire" leaves; the audit trail gets `source_closed` with the source, the answer and the HTTP status; unused claim links are revoked); a 200 notes the posting as checked today; an error, a timeout or any other status leaves it exactly as it is; a 429 stops the asking at once; at most 30 postings are asked per run, the longest-unchecked first (the rest are `remaining`), within a 45 second budget; if more than 30% of at least five definite answers say closed or gone, the source is misbehaving (an outage, a changed address) and NOTHING is taken down that run (`aborted: "too_many_ended"`); a claimed posting belongs to its owner and is never touched; a source with a price per call, or without such an address, is never asked; a failure here is reported (`reconciled.error`) and never fails the run or the import. The report carries `reconciled: { checked, open, takenDown, unknown, remaining, aborted?, error? }`. Checked live on 2026-10-30 with five requests: four jobs of ours answered 200 JSON, a made-up slug answered 404 JSON (`{"ok":false,"errors":"Job not found."}`); a 410 was not observed, it is what the docs promise.

**3. A run always read every enabled source.** To read Jobicy again (once an hour) Himalayas (once a day) had to be read again too. The request body now takes `"sources": ["remoteok", "jobicy"]` (one to eight ids of the form `[a-z0-9-]`, anything else is refused with `bad_request`): only those sources run, a named source that is not enabled is reported `skipped: not_enabled` and never run, and the answer repeats `only`. Without the list every enabled source runs, exactly as before. The kill switch, the per-source lock and the budget apply as they always did.

**To deploy:** paste `supabase/functions/_shared/discovery/{sources,pipeline,http}.ts` and `supabase/functions/external-discovery-run/index.ts` into the kretopia-app project and redeploy `external-discovery-run` (the two other functions import `pipeline.ts` but use none of this). Check afterwards with one call limited to a source that may be read again (`{"slot": "...", "sources": ["jobicy"]}`: the report must list only Jobicy). The first Himalayas run after that shows `reconciled`.

## Not verified

No real signed-in session, no real feed, no real model, no real domain proof was exercised (all fakes, fixtures and a local
database). The deployed copies of the shared files were not diffed. The reviewer UX was not looked at in a browser.
