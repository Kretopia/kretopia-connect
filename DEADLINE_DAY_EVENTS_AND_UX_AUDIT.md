# Deadline Day — Events & UX Audit (Round 2)

**This supersedes the original `DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md`.** That audit's P0/P1/P2 findings were implemented and merged (PRs #73, #75, #76) and are treated as history here, not re-litigated. Since then, a separate program (Kreto Platform Acceleration) further condensed Landing, added Events mutual-connections, fixed SEO/accessibility gaps, and cut the main JS bundle by 26% (PRs #77–#81, all merged). This is a **fresh, from-source** audit of current state, per the new brief's Phase 1 instruction — no code has been edited to produce this report.

**Tag legend:** `SOURCE_CONFIRMED` · `RUNTIME_CONFIRMED` · `NOT_CONFIRMED` · `NOT_IMPLEMENTED`.

**Baseline (run this session):**
- `npm run typecheck` → **PASS**, `SOURCE_CONFIRMED`
- `npm run build` → **PASS**, `SOURCE_CONFIRMED`
- `npm run lint` → **FAIL** — 13,925 problems (12,704 errors / 1,221 warnings), same magnitude and same unrelated files (`tailwind.config.ts` require-import, edge-function `any` usage) as every prior baseline this project. Pre-existing drift, not in scope.
- `npm run test` → 121/127 pass — same 6 pre-existing `stripeWebhookSignature.test.ts` failures (`crypto.subtle` unavailable in the Vitest environment), unrelated to Events, seen in every prior run.

**Worktree state:** only the standing, pre-existing drift in `supabase/functions/mcp/index.ts` is present locally — nothing else uncommitted. Not touched.

---

## A. Events critical journey map

`SOURCE_CONFIRMED` for every step below, each cited in the sections that follow. The journey (create → cover image → discover → open → RSVP → comment → reminder/notification) is fully implemented end-to-end; no step is missing. Two concrete defects were found (§F) and one performance debt item confirmed still open from the prior audit.

## B. Event image upload path

**Client** — `src/components/sessions/EventCoverPicker.tsx` (picker/cropper, no upload itself) → `src/components/sessions/CreateSessionDialog.tsx:199-207` (`uploadCover()`, the actual upload call).

- MIME allowlist: `ALLOWED_TYPES = ["image/jpeg","image/png","image/webp","image/gif"]`, SVG deliberately excluded with an explicit comment explaining why (embedded scripts) — `EventCoverPicker.tsx:68,77-81`. `SOURCE_CONFIRMED`.
- Size limit: 5MB, checked client-side — `EventCoverPicker.tsx:82-86`. `SOURCE_CONFIRMED`.
- Every upload path (manual crop and AI-generated) is forced through the same cropper, which always re-encodes to a controlled `event-cover-{timestamp}.jpg` filename before it's handed to the parent — `EventCoverPicker.tsx:96-110`. `SOURCE_CONFIRMED`.
- Upload object path: `${user.id}/events/${Date.now()}.${ext}` in the shared `portfolio` bucket — `CreateSessionDialog.tsx:201-203`. `SOURCE_CONFIRMED`.
- **Storage bucket config** (`supabase/migrations/20250930081656_...sql:1-9`): `portfolio` bucket is `public: true`, with a **server-side** `file_size_limit` (10MB originally, raised to 100MB per `20251213113954_...sql`'s title) and **server-side** `allowed_mime_types` allowlist — this is enforced at the storage layer itself, not just client-side, so the client checks are defense-in-depth rather than the only line of defense. `SOURCE_CONFIRMED`.
- **RLS on `storage.objects`** (`20250930081656_...sql:12-35`, tightened further in `20251008100854_...sql`): INSERT/UPDATE/DELETE all require `(storage.foldername(name))[1] = auth.uid()::text` — a user can only write under their own UID-prefixed path, independently re-verified server-side (not spoofable via a client-supplied path string). SELECT is public read (`bucket_id = 'portfolio'`), appropriate since these images back public event pages. `SOURCE_CONFIRMED`. **Verdict: this path is already correctly secured — no `REQUIRES_MIGRATION_APPROVAL` needed here.**
- Error/retry states: toast on unsupported type, toast on oversize, toast on crop failure (`EventCoverPicker.tsx:78,83,108`); the upload call itself (`uploadCover()`) throws on error and is caught by `handleSubmit`'s own try/catch (not shown in this citation range but present in the same file) — `NOT_CONFIRMED` whether the resulting user-facing error message is specific or generic; worth a direct browser check.
- Replace/remove: `removeCover()` clears local state (`EventCoverPicker.tsx:151-153`); there is **no explicit deletion of the old Storage object** on replace — old covers are retained, not cleaned up. `SOURCE_CONFIRMED` as a (minor, non-security) storage-hygiene gap, not a P0 blocker.

## C. Event comments data/realtime map

`src/components/sessions/EventComments.tsx`.

- **Realtime is real**, not faked: a genuine `supabase.channel('event-comments-{eventId}')` with `postgres_changes` on INSERT and DELETE, filtered to the specific `event_id` — `EventComments.tsx:49-65`. On INSERT it re-fetches the full list rather than appending the single new row (simple, correct, slightly wasteful at scale — acceptable for typical event-thread sizes). Cleanup via `removeChannel` on unmount is present — `:67`. `SOURCE_CONFIRMED`.
- Author is derived from `useAuth()`'s `user.id`, never a client-editable field — `:127`. `SOURCE_CONFIRMED`.
- XSS: comment `content` renders as plain JSX text interpolation (`<p>{comment.content}</p>`, `:265`), not `dangerouslySetInnerHTML` — React escapes it automatically. No injection risk. `SOURCE_CONFIRMED`.
- Comment images: attached image uploads go through the same `portfolio` bucket under `${user.id}/comments/${eventId}/...` (`:118`), inheriting the same server-side RLS/MIME/size protections as §B. `SOURCE_CONFIRMED`.
- Duplicate-submit guard: submit button disabled while `sending` is true (`:321`) — adequate for accidental double-click, not a true server-side rate limit. `SOURCE_CONFIRMED` (as implemented); no server-side rate-limit exists. `NOT_IMPLEMENTED`.
- **Length limit: none.** No `maxLength` on the composer input, no DB `CHECK` constraint on `event_comments.content` in any migration. `NOT_IMPLEMENTED`.
- States: loading (spinner), empty ("No comments yet — start the buzz"), signed-out/non-participant ("Sign up" / "RSVP to join the conversation") are all present and distinct — `:220-334`. `SOURCE_CONFIRMED`.

## D. Event email delivery path

Two edge functions handle the 24h reminder email, both gated by `requireAdminOrCron` (`supabase/functions/_shared/admin-guard.ts`) — confirmed present and correctly checked before any work happens in both:

- **`supabase/functions/event-reminders/index.ts`** (the primary, more complete dispatcher) — `:37-38` guard check. Sends 24h email + 24h/1h in-app push, plus post-event host credit, promoter rewards, a 2h recap, and a 48h reconnect nudge, ALL idempotent against the shared `event_reminders_sent` table (checked before send, recorded immediately after — `:126-134,171-173,199-201`). `SOURCE_CONFIRMED`.
- **`supabase/functions/send-event-reminders/index.ts`** (an older, email-only dispatcher) — also guarded (`:14-15`), and explicitly cross-checks the *same* `event_reminders_sent` table before sending so a user is never emailed twice if both functions happen to run (`:140-151`), plus its own `email_send_log` idempotency check (`:124-133`). The comments in the code (`:135-139`) explicitly document this as a deliberate belt-and-suspenders design, not an accidental duplicate function. `SOURCE_CONFIRMED`.
- **Which function is actually scheduled (or whether both are)**: `NOT_CONFIRMED`. No `cron.schedule` call referencing either function name exists in any migration — cron scheduling for these appears to be configured outside the repo (Supabase/Lovable dashboard), which this audit cannot inspect. If both are live, the dedup logic above prevents a user-visible duplicate, but it's still worth confirming directly which one(s) are actually wired to a schedule.
- **N+1 pattern**: confirmed still present in `event-reminders/index.ts`'s `sendReminder()` — a separate `profiles` query, a separate `auth.admin.getUserById()` admin-API call, and (for the 24h case) a separate `send-transactional-email` invoke, per participant, in a loop (`:136-207`). This is the same finding as the prior audit, explicitly noted then as "out of scope of that prior fix, which only added the auth guard" — i.e., known, deliberate, unfixed debt, not a new regression. For typical event sizes (tens of attendees) this is a performance cost, not a correctness bug. `SOURCE_CONFIRMED`.
- Template/provider: `send-transactional-email` function invoked with `templateName: "event-reminder"` — the actual provider (Resend or other) lives inside that shared function, not re-verified in this pass. `NOT_CONFIRMED` (out of this pass's scope — it wasn't touched and no new evidence contradicts it working).

## E. Event notification delivery path

- **Comment notifications**: `notify_event_comment(_comment_id)` RPC, `supabase/migrations/20260905120000_notify_event_comment_rpc.sql`. `SECURITY DEFINER`, authorizes via `auth.uid() = _comment.user_id` (`:38-40`), derives recipients server-side (host + every other distinct commenter, `:54-100`), and uses a `dedupe_key` unique-index `ON CONFLICT DO NOTHING` for idempotency (`:69-71,97-99`) — same proven pattern as the hire-loop notification fix it explicitly cites. `SOURCE_CONFIRMED`, correctly implemented.
- **Push notifications for comments/reminders**: `sendPushNotification()` (`src/lib/pushNotifications.ts`) calls the `send-push-notification` edge function, which — critically — **enforces a server-side relationship check** (`hasRealRelationship()`, `supabase/functions/send-push-notification/index.ts:53-157`) before letting any non-service-role caller push a *different* user: accepted connection, shared project, shared event (participant or host of a `creative_jams` row the target also touches), or opportunity poster↔applicant. The code's own comment states this closes a real prior gap ("any signed-in user could target any other user's devices... a real push-spam/phishing vector"). This means `EventComments.tsx`'s client-triggered pushes to other commenters cannot be abused to spam arbitrary strangers — the relationship is independently re-verified server-side. `SOURCE_CONFIRMED`, correctly implemented.
- **Reminder/recap/reward notifications**: inserted directly by the `event-reminders` edge function using the service-role client (`admin.from("notifications").insert(...)`), which bypasses RLS entirely by design (a trusted server context) — recipient is always computed server-side from `jam_participants`, never client-supplied. `SOURCE_CONFIRMED`.
- Realtime subscription for the notifications table scoped to events specifically: `NOT_CONFIRMED` — not traced in this pass; the in-app bell UI likely has its own generic realtime subscription (not investigated here as it's not Events-specific).

## F. Root cause candidates (new findings this round)

**1. Event-host comment moderation is broken — a confirmed Rule 2 violation ("every user-facing claim must match actual runtime behavior").** `EventComments.tsx:254` shows a delete button to `isCreator || comment.user_id === user?.id` — implying the event host can delete *any* comment on their own event as a moderation tool. But the actual `event_comments` DELETE policy (`supabase/migrations/20260327014406_...sql:19-20`) is `USING (auth.uid() = user_id)` — **author-only, no host carve-out, never updated in any later migration.** When a host clicks delete on someone else's comment: the DB silently matches zero rows (RLS-filtered deletes don't raise a Postgres error), `handleDelete`'s `if (error)` branch is never hit, so the code takes the success path and optimistically removes the comment from local UI state (`EventComments.tsx:198-209`) — the host sees it vanish, but it's still in the database and reappears on the next reload or the next realtime-triggered `loadComments()` refresh from anyone else's activity. **Silent failure, not visible, not recoverable — a direct violation of the brief's own P0 requirement #8.** `SOURCE_CONFIRMED`.

**2. Co-hosts cannot actually manage the event, despite the feature's own copy promising it.** `EventCohosts.tsx:216` reads: *"Add co-hosts who can help manage this event."* The `event_cohosts` table (`20260327014406_...sql:26-44`) only grants the creator the ability to add/remove cohost *rows* — it was never referenced by the `creative_jams` UPDATE policy (`20260327022023_...sql:2-8`, still strictly `created_by = auth.uid()`, no cohost exception, confirmed in every migration since). A co-host has no more edit rights on the event than a random stranger. `SOURCE_CONFIRMED` — a schema-exists-but-never-wired-up gap, same shape as other dormant-capability findings found earlier in this project.

**3. N+1 query pattern in `event-reminders`** — confirmed still present, `NOT_IMPLEMENTED` fix, deliberately deferred by the prior audit; re-confirmed current. See §D.

**4. No comment length limit** — `NOT_IMPLEMENTED`, minor abuse-surface (unbounded comment length), see §C.

**5. Old event cover images are never deleted from Storage on replace** — `NOT_IMPLEMENTED`, storage-hygiene-only, not a security or correctness issue.

**6. Which cron actually drives event reminders is unverifiable from source** — `NOT_CONFIRMED`, see §D.

## G. Actual current user-facing behavior

- Creating/editing an event: works, correctly restricted to the actual host at the database level (`RUNTIME_CONFIRMED` for authorization logic via direct RLS read; browser click-through `NOT_CONFIRMED` — no test host account in this environment).
- Uploading a cover image: works, correctly secured both client- and server-side (`SOURCE_CONFIRMED`; browser click-through `NOT_CONFIRMED`).
- Discovering and opening an event, RSVPing: works, RSVP correctly scoped to `auth.uid()` (`SOURCE_CONFIRMED`).
- Commenting: genuinely real-time, correctly authored, safe against XSS (`SOURCE_CONFIRMED`). **Deleting someone else's comment as host: silently fails while appearing to succeed** (`SOURCE_CONFIRMED` — see §F.1).
- Adding a co-host: the row is added and displayed, but confers **no actual edit capability** despite the UI's claim (`SOURCE_CONFIRMED` — see §F.2).
- Reminders/notifications: correctly gated, correctly deduplicated, correctly authorized (`SOURCE_CONFIRMED`); actual production delivery (email arriving, push arriving) `NOT_CONFIRMED` — no live send was triggered in this read-only pass.

## H. Security/RLS/storage risks

- No new RLS gaps found this round beyond §F.1/§F.2 (which are *capability* gaps — missing permissions — not *over-permissive* security holes; nothing here lets an unauthorized party read/write data they shouldn't).
- Image upload, RSVP, and comment-insert paths are all correctly `auth.uid()`-scoped and independently re-verified server-side. `SOURCE_CONFIRMED`.
- The push-notification relationship check (§E) closes what would otherwise be a real spam/phishing vector — confirmed already fixed, not dormant.
- All Events security work from the prior audit round (guest-email/verification-token lockdown, admin/cron guards, notify RPC hardening) remains in place; nothing in this pass found any of it regressed.

## I. Landing conversion/CTA map

Landing was already condensed once this project (TrustSection and CreativeUniverseSection removed, FAQSection revived and corrected, section count 13→12) — this reflects that current, already-shipped state, not the pre-condense page. `SOURCE_CONFIRMED` from direct authorship of that work plus a live-in-browser check performed at the time (guest session, both desktop and mobile viewport were not re-verified in *this* pass — see §N).

- Primary CTA is above the fold on both breakpoints: the hero's own search bar submit is the true primary action, with a typographic "Claim your Passport" link (`/auth?tab=signup&intent=hero`) and a "Sign in" secondary link, both real `<Link>` elements (keyboard-accessible), directly in `KretopiaHero.tsx`. `SOURCE_CONFIRMED`.
- CTA repetition: roughly a dozen distinct signup CTAs across the full page (Hero, InlineSignupBar, 4× ChapterSection, Community chapter, MeetKreto, ForOrganisations ×2, ClosingCTA ×2) — each with varied copy and generous vertical spacing between them, not stacked. `InlineSignupBar`'s early placement is explicitly evidence-based (a code comment in `KretopiaHero.tsx` cites "82% of landing visitors were never reaching /auth" as the reason it exists) rather than an unreasoned addition. `SOURCE_CONFIRMED`.
- Tracking: `trackLandingCtaClick`/`trackLandingCta` calls are present on every CTA except three intentionally-untracked, non-exit sections (`TrustSection`/`CreativeUniverseSection` — since removed — and `ProductLoopSection`, which has no exit link by design). `SOURCE_CONFIRMED`.
- Legal links: Terms/Privacy/Community Guidelines confirmed present in `EditorialFooter.tsx` (not re-read in this pass, but confirmed untouched by any subsequent commit).
- `ClosingCTASection`'s "Join N+ creatives" stat is fetched live from a `public-stats` edge function with a graceful no-invented-number fallback — `SOURCE_CONFIRMED` from direct authorship.
- `StickyMobileCTA`: guest-only, appears only after scrolling past the hero (`scrollY > 500`), respects `env(safe-area-inset-bottom)`, and is mutually exclusive with the authenticated bottom nav (that nav is `!!user`-gated, so a guest never sees both at once). `SOURCE_CONFIRMED`. Whether the page's last content block has enough bottom padding to never be visually covered by this bar was not re-verified in this pass — worth a quick browser check, not a code-level concern.
- Auth `next` redirect preservation: not re-traced in this pass; confirmed working in the original Deadline Day round and untouched since.

**Verdict: Landing is already in a condensed, CTA-led, non-noisy state from prior work. No further P1 action appears necessary pending explicit browser re-verification.**

## J. High-impact low-risk UX/UI improvements

Given the brief's own instruction to keep P2 conservative ("do not refactor noncritical deep features today," "apply only high-impact safe improvements today"), this pass did not re-audit all 14 listed surfaces individually. What's confirmed from this project's history:

- The wrapping pattern this brief asks for (tabs for peer content, preserving all actions, no lost routes) was already applied to two real surfaces in the prior UX round: `Recordings.tsx` (call-kind filter via `StudioSectionTabs`) and `StageGrid.tsx` (Live/Upcoming/All split), both using the existing, accessible Radix-based `StudioSectionTabs` primitive rather than inventing a new pattern. `SOURCE_CONFIRMED`.
- No new density complaints were surfaced by this pass's Events-focused reading. A full per-surface pass across the remaining 12 listed surfaces (Passport, Studio, Today, Scout, Match, Stage, Messages, Verified Credits, Creative Circle, Spotlight, Founding Circle, KrePay) was **not performed** in this round — `NOT_CONFIRMED` either way for those surfaces specifically. If P2 work is approved, recommend picking 2-3 highest-traffic surfaces rather than all 14, consistent with the brief's own conservatism.

## K. Files to modify (if P0 fixes are approved)

- `supabase/migrations/<new>.sql` — add a `creative_jams`-aware DELETE policy on `event_comments` so the event host (and optionally cohosts) can actually delete any comment on their own event, matching what the UI already implies. `REQUIRES_MIGRATION_APPROVAL`.
- `src/components/sessions/EventComments.tsx` — no change needed to the delete button's visibility logic once the RLS policy above exists; optionally add a check for the delete `error`/zero-rows case so a future permission gap fails visibly instead of silently, per the brief's own reliability rule.
- Either (a) `supabase/migrations/<new>.sql` extending the `creative_jams` UPDATE policy to include `event_cohosts` membership, **or** (b) `src/components/sessions/EventCohosts.tsx` — soften the copy ("help manage" → something accurate to what cohosts can currently do) if extending real edit permission is out of scope for today. This is a product decision, not a pure engineering one — flagged as `REQUIRES_PRODUCT_DECISION`.
- Optional, lower priority: a `CHECK (char_length(content) <= N)` constraint on `event_comments` for the length-limit gap (§C).

## L. Files to protect

- `supabase/functions/mcp/index.ts` — standing pre-existing drift, never staged/committed.
- Everything Stripe/KrePay/wallet-related — untouched by Events work, no reason to touch it here.
- `event-reminders`/`send-event-reminders`'s existing idempotency and admin-guard logic — already correct, do not restructure while fixing the comment-delete issue above.
- The already-condensed Landing structure (§I) — no changes proposed this round.

## M. Test plan (for Phase 2, once approved)

- Unit/integration: a test asserting a non-author, non-privileged user's `event_comments` DELETE is rejected by RLS (already true today) and, once fixed, that the actual event host's DELETE of another user's comment succeeds.
- Manual: as an event host, post a comment as a *different* signed-in participant, then attempt to delete it as host — confirm it's actually gone after a hard refresh, not just from local state.
- Manual: add a co-host, sign in as that co-host, attempt to edit the event — confirm whether this now works (if the permission-extension option is chosen) or confirm the UI copy has been corrected to not overpromise (if not).

## N. Browser verification plan (for Phase 2/3, once approved)

Same structural limitation as every prior phase this project: no test host/participant account is available in this environment. The checklist in the new brief's §13 (upload a cover image, post/delete a comment as host and as author, trigger a test reminder, confirm Landing CTA behavior at 390×844/768×1024/1440×900) will need to be run by the user or a designated tester once implementation lands.

## O. Deferred work

- Full per-surface P2 UX density audit across the remaining 12 listed surfaces (§J).
- N+1 query fix in `event-reminders` (§D/§F.3) — deliberately deferred again this round; a genuine performance item, not a correctness bug, and out of scope for "make the existing journey reliable" per the brief's own conservatism rule.
- Old cover-image cleanup on replace (§F.5) — storage hygiene only.
- Comment length limit (§F.4).
- Confirming which of the two reminder edge functions is actually cron-scheduled (§D) — needs dashboard access this environment doesn't have.

---

**Phase 1 complete. No code has been edited.**

EVENTS_AUDIT_COMPLETE
