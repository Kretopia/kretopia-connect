# Lot B -- the other privacy tables: decisions owed, not guesses

This is derived from the repository's migrations only (the final state of every straight-line `CREATE POLICY` / `DROP POLICY`; six migrations that drop policies in a loop are not simulated). It is a candidate list, not the production state, and it is **not** the dashboard's list of seven. Run `00_discovery.sql` for the real state, then use this file to record, for each table, one of three decisions:

* **public**: stays readable by anyone, as it is;
* **projected**: readable through a view or a column list that leaves out what must not leak;
* **closed**: readable by its owner, the people it concerns, or an admin only.

Nothing below is written as SQL on purpose: a policy for a table whose contract is not stated is a guess, and a wrong guess closes a feature or opens a leak. Once a table has a stated contract it becomes one more lot with the same four files as `waitlist` (preflight that stops on an unknown policy, apply that replaces them, verify, rollback that says what it reopens).

## A. Public by the look of the name (community and portfolio content). Probably stays public; the decision to confirm is only whether signed-out visitors should read it, and which columns

| table | permissive policies that are literally true | first seen in |
|---|---|---|
| `awards` | SELECT Users can view all awards (public) | 20251001040029_e8d405a3-2a |
| `credits` | SELECT Users can view all credits (public); SELECT Anyone can read credits (authenticated) | 20251001040029_e8d405a3-2a |
| `press_links` | SELECT Users can view all press links (public) | 20251001040029_e8d405a3-2a |
| `award_comments` | SELECT Users can view all comments (public) | 20251019124116_cfc1a0b8-93 |
| `credit_comments` | SELECT Users can view all comments (public) | 20251019124116_cfc1a0b8-93 |
| `press_comments` | SELECT Users can view all comments (public) | 20251019124116_cfc1a0b8-93 |
| `portfolio_comments` | SELECT Users can view all comments (public) | 20251019124116_cfc1a0b8-93 |
| `feed_comments` | SELECT Anyone can view comments (public) | 20260214124405_782e82c1-ac |
| `feed_reactions` | SELECT Users can view all reactions (public) | 20251004031510_60f5d7bd-d9 |
| `community_members` | SELECT Anyone can view community members (public) | 20251118012046_52585a6d-8d |
| `community_post_reactions` | SELECT Anyone can view reactions (public) | 20251105014616_b5cc6912-a4 |
| `credit_reactions` | SELECT Anyone can view credit reactions (public) | 20260406203737_607c68e2-d4 |
| `digital_product_reviews` | SELECT Anyone can view reviews (public) | 20251109022231_3c1b2d1c-5b |
| `product_reviews` | SELECT Anyone can view product reviews (public) | 20260121225858_7a5363df-54 |
| `service_tiers` | SELECT Anyone can view service tiers (public) | 20260411174809_09e034bd-c5 |
| `icdb_companies` | SELECT Anyone can read ICDB companies (public) | 20260328163842_2bb0825c-dc |
| `icdb_project_roles` | SELECT Anyone can read ICDB roles (public) | 20260328163842_2bb0825c-dc |
| `icdb_projects` | SELECT Anyone can read ICDB projects (public) | 20260328163842_2bb0825c-dc |
| `icdb_role_taxonomy` | SELECT Anyone can read taxonomy (public) | 20260328172603_eb907fde-00 |
| `location_categories` | SELECT Anyone can read categories (public) | 20260402004501_8b14cb26-65 |
| `industry_stats` | SELECT Authenticated users can view industry stats (authenticated) | 20251001001606_ab4f91f9-68 |
| `event_host_stats` | SELECT Public can view host stats (public) | 20260420144611_875ccfc9-a2 |

## B. Readable by every signed-in member. The question is whether EVERY member should see EVERY row, and which columns

| table | permissive policies that are literally true | first seen in |
|---|---|---|
| `circle_channels` | SELECT Anyone can view circle channels (authenticated) | 20260328003640_805cdd09-9c |
| `event_cohosts` | SELECT Anyone can view cohosts (authenticated) | 20260327014406_3f60ce28-f6 |
| `event_comments` | SELECT Anyone can view event comments (authenticated) | 20260327014406_3f60ce28-f6 |
| `location_review_helpful` | SELECT Anyone can view helpful votes (authenticated) | 20260402012218_a077d0b5-61 |
| `location_reviews` | SELECT Anyone can view reviews (authenticated) | 20260401235249_7be2c169-0b |
| `sound_stages` | SELECT Anyone signed in can view sound stages (authenticated) | 20260517125613_d94d18a2-fc |
| `spark_message_reactions` | SELECT Anyone can view reactions (authenticated) | 20260327234827_5ffa51ce-0a |
| `speed_sessions` | SELECT Anyone signed in can view speed sessions (authenticated) | 20260517125613_d94d18a2-fc |
| `credit_vouches` | SELECT Vouches are viewable by authenticated users (authenticated) | 20260424235925_a17745bc-0b |
| `profile_core` | SELECT Authenticated users can view profile_core for discovery (authenticated) | 20260708150000_profile_spl |

## C. The name suggests evidence, attendance or internal configuration. These are the likeliest candidates for the privacy alerts; decide first

| table | permissive policies that are literally true | first seen in |
|---|---|---|
| `credit_evidence` | SELECT Anyone can read credit evidence (authenticated) | 20260914100000_create_cred |
| `credit_ai_verifications` | SELECT Anyone can view ai verifications (authenticated) | 20260326174420_dac49154-72 |
| `speed_session_rsvps` | SELECT Anyone signed in can view RSVPs (authenticated) | 20260517125613_d94d18a2-fc |
| `orch_tool_registry` | SELECT Authenticated read orch tool registry (authenticated) | 20260501201445_1e56ef9e-a9 |
| `wallet_transfer_limits` | SELECT Anyone can read transfer limits (authenticated) | 20260306101009_e8f67004-77 |
| `tracked_storage_buckets` | SELECT Tracked buckets are readable by everyone (public) | 20260502122249_e32fcc29-7e |

## E. `INSERT ... WITH CHECK (true)`: anyone may write. Decide the columns and the volume, not only the principle

| table | policy | first seen in |
|---|---|---|
| `circle_guest_rsvps` | Anyone can create a guest RSVP (public) | 20260421201443_1c0b20a9-03 |
| `email_unsubscribes` | Anyone can unsubscribe (anon) | 20260304185616_0cf16ab4-4b |
| `event_share_clicks` | Anyone can log share clicks (anon, authenticated) | 20260428040057_3ac2c305-c6 |
| `guest_rsvps` | Anyone can create guest RSVP (public) | 20260420153544_c73f3057-d3 |
| `newsletter_subscribers` | Anyone can subscribe (public) | 20260415171541_8d4f325e-1d |
| `partner_signups` | Anyone can submit partner signup (authenticated, anon) | 20260327223242_5a40d534-9d |
| `partner_submissions` | Authenticated users can submit partner applications (authenticated) | 20260127164738_d16ab79a-8a |
| `projects` | Users can create their own projects (authenticated) | 20251005013601_e63c6845-c8 |

Notes on E: `circle_guest_rsvps`, `guest_rsvps`, `newsletter_subscribers`, `partner_signups`, `email_unsubscribes` and `event_share_clicks` are visitor-facing by design; what remains to decide is the column list a visitor may write (as in the waitlist lot) and a size bound. `projects` is superseded: its INSERT policy is the SEC-02 one you applied (`auth.uid() = created_by`); lot 0 asks the catalog to confirm that no permissive INSERT policy still reads `true`.

## What would turn a row into a lot

1. The decision (public / projected / closed) and, for projected, the list of columns that stay readable.
2. For INSERT: the columns a visitor may write and the values they must not be able to choose.
3. Which feature reads the table today (so that nothing the product needs is closed): the front end and the edge functions that touch it.
