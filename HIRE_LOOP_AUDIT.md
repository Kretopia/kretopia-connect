# Hire Loop Audit — Missing "Studio Created" Notification

**Scope:** trace the applicant → apply → message → interview → accept → Studio flow end‑to‑end in code and find why the applicant is never notified when a recruiter accepts them and a Studio (a row in `projects`, rendered at `/desk/:projectId`) is created for them.

**Status:** read‑only audit. No files were modified.

---

## 0. Terminology established from code

"Studio" is not a separate table. It is the product name for a row in `public.projects`, rendered by `src/pages/ThriveDesk.tsx` at route `/desk/:projectId` (`src/App.tsx:371`). The creator's "Studios" list is `src/pages/WorkHome.tsx` (route `/desk`, `src/App.tsx:367`), which renders `StudioCardsGrid` over the user's `projects` rows (`src/pages/WorkHome.tsx:52,627`). Access to a specific Studio is a membership row in `public.project_collaborators` (join table), not a separate ACL table.

---

## 1. Current sequence (as it actually happens in code)

**Applicant: view + apply**
- Route `/opportunity/:id` → `src/pages/OpportunityDetail.tsx` (`src/App.tsx:484`).
- The page loads the applicant's own application state: `supabase.from('applications').select('id, status')...` (`src/pages/OpportunityDetail.tsx:246`) and renders status copy at lines 763‑792.
- Apply button opens `ApplyToOpportunityDialog` (imported `src/pages/OpportunityDetail.tsx:12`, rendered `:819`).
- `src/components/ApplyToOpportunityDialog.tsx` `handleSubmit` inserts into `applications` with `status:'pending'` (`ApplyToOpportunityDialog.tsx:91‑98`), then:
  - fires `send-transactional-email` (`application-confirmation`) to the applicant, fire‑and‑forget `.catch(() => {})` (lines ~128‑135)
  - fires `send-transactional-email` (`new-applicant-notification`) to the recruiter, same swallow pattern (lines ~148‑158)
  - calls `notifyOpportunity(opportunity.created_by, ...)` → `src/lib/pushNotifications.ts:114‑122`, which calls `sendPushNotification({ userId: opportunity.created_by, ... })` — **this is the recruiter‑facing twin of the same notification path that is broken for applicants; see §3.**

**Messaging**
- Table: `public.messages` (`sender_id`, `receiver_id`, `match_id`, `content`) created in `supabase/migrations/20250930141941_c6db1045-3991-4a90-8f37-bf98d8083d4e.sql:6‑31`, RLS: sender/receiver only.
- From the recruiter's applicant card, "Message" (`handleMessage`, `src/pages/OpportunityDashboard.tsx:814‑840`) first ensures a bidirectional `connections` row exists (upsert, lines 826‑834) so the thread appears in each inbox, then navigates to `/messages?user=<applicant_id>`.

**Video interview**
- From the same applicant card, "Interview" (`handleInterview`, `src/pages/OpportunityDashboard.tsx:807‑812`) calls `useStartDirectCall().start(applicant.applicant_id, ...)` (`src/hooks/useStartDirectCall.ts:41‑90`), which invokes edge function `create-direct-video-call` and opens `<VideoCallSheet>` (`src/pages/OpportunityDashboard.tsx:1063‑1073`). Notably, `useStartDirectCall.ts:31‑48` guards against a double‑click firing two calls with an `inFlightRef` — **this exact guard is absent from the Accept button, see §9.**

**Recruiter: accept → Studio creation**
- All list/kanban views funnel into a single handler: `updateApplicationStatus` (`src/pages/OpportunityDashboard.tsx:360‑460`). Both `ApplicantCard`'s "Accept" button (`src/pages/OpportunityDashboard.tsx:1030‑1036`, `onClick={() => onStatusChange(applicant.id, 'accepted')}`) and the drag‑and‑drop pipeline view (`src/components/opportunity/ApplicantPipeline.tsx:298‑312`, `onStatusChange` prop) call the same function — no duplicate/hidden code path.
- Status transition: `supabase.from('applications').update({ status: newStatus }).eq('id', applicationId)` (`OpportunityDashboard.tsx:360‑364`), table `public.applications`, values `pending|shortlisted|accepted|rejected` (`OpportunityDashboard.tsx:53`). Purely client‑side; **no RPC or Edge Function performs this transition.**
- On `newStatus === 'accepted'` (`OpportunityDashboard.tsx:378‑451`):
  1. `INSERT INTO projects (title, description, created_by, status:'active')` — **this is the Studio** (`OpportunityDashboard.tsx:382‑391`).
  2. `INSERT INTO project_collaborators (project_id, user_id: applicant.applicant_id, status:'pending')` then immediately `UPDATE ... SET status:'accepted'` (`OpportunityDashboard.tsx:396‑414`) — this is what grants the applicant RLS access to the Studio (see §7).
  3. `supabase.functions.invoke('send-project-invitation', ...)` (lines 423‑430).
  4. `await notifyApplicantStatusChange(applicant.applicant_id, 'accepted', opp.title, opp.id, project.id)` (`OpportunityDashboard.tsx:433`) — **this is the "should notify applicant" step.**
  5. Success toast, `return`.

**`notifyApplicantStatusChange`** (`OpportunityDashboard.tsx:301‑358`):
  - Fires `send-transactional-email` (`application-status-update`) with `recipientUserId: applicantUserId`, fire‑and‑forget `.catch(() => {})` (lines 321‑334) — no error surfaced even to console.
  - Calls `sendPushNotification({ userId: applicantUserId, ... })` (`src/lib/pushNotifications.ts:21‑72`), which:
    - inserts into `public.notifications` with `user_id: applicantUserId` (`pushNotifications.ts:26‑40`) — **the in‑app notification the bell/`NotificationCenter` reads.** Any error is only `console.error`'d (line 43); the function does **not** rethrow and still returns `{ success: true }` at line 67.
    - invokes edge function `send-push-notification` (`pushNotifications.ts:48‑61`), which (per `supabase/functions/send-push-notification/index.ts:181‑197`) only does anything if the applicant already has a row in `push_subscriptions` (i.e., previously granted browser push permission) — most users won't.

**Applicant: sees the Studio**
- `WorkHome.tsx` (route `/desk`) fetches `projects` on load/refetch and renders it via `StudioCardsGrid`. There is no realtime push/toast telling the applicant a new Studio exists — they see it only the next time they load `/desk`.

---

## 2. Expected sequence

1. Applicant applies → recruiter is notified (in‑app + email).
2. Recruiter reviews, messages, optionally starts a video interview.
3. Recruiter clicks Accept → `applications.status` becomes `accepted`.
4. A Studio (`projects` row) is created exactly once and the applicant is granted access via `project_collaborators`.
5. **The applicant receives an in‑app notification (bell) and an email** telling them they were hired and linking to the new Studio, deduplicated so re‑accepting or retries never produce a second notification or a second Studio.
6. Applicant opens the notification and lands on `/desk/:projectId`, which they can access because RLS grants it.

Steps 1‑4 and 6 work today. Step 5 is where the app fails.

---

## 3. Broken transition — root cause, not just symptom

The failure is **not** a missing call. `notifyApplicantStatusChange` **is** invoked (`OpportunityDashboard.tsx:433`) and it **does** attempt to write the in‑app notification row (`pushNotifications.ts:27‑40`). The break is that this client‑side `INSERT INTO notifications` is executed with the **recruiter's** session (`auth.uid()` = recruiter), targeting `user_id: applicantUserId` (a different user). Since **March 2026**, Row‑Level Security on `public.notifications` no longer allows that:

```sql
-- supabase/migrations/20260327223242_5a40d534-9d33-4989-bbd5-95e56ce0b0d9.sql:1-10
-- SECURITY FIX 2: Notifications - restrict INSERT
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Users can only create own notifications or admin"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);
```

**Full history of this policy** (every migration touching `notifications … FOR INSERT`, chronological):

| Migration | Effect |
|---|---|
| `20250930141941_c6db1045-3991-4a90-8f37-bf98d8083d4e.sql:63‑85` | `notifications` table created, RLS enabled, **no INSERT policy at all** (implicit deny‑all). |
| `20251213061246_61ae10db-dba7-49d0-9af7-8771b4c9898c.sql:3‑8` | Adds `"Authenticated users can create notifications" ... WITH CHECK (true)` — any authenticated user can insert a notification for any other user. This is what made the recruiter→applicant insert in `pushNotifications.ts` work in the first place. |
| `20260327223242_5a40d534-9d33-4989-bbd5-95e56ce0b0d9.sql:1‑10` | **Correctly closes a real spoofing/spam hole** (any user could plant fake notifications in anyone else's feed) by restricting INSERT to `auth.uid() = user_id OR admin`. Nothing after this migration touches the INSERT policy — it is the live policy today. |

So the March "SECURITY FIX 2" patch was the right call for the vulnerability it closed, but it silently broke every **client‑side, cross‑user** notification insert in the app that hadn't been migrated to a server‑side/`SECURITY DEFINER` path. The hire‑acceptance flow is one of them. The insert now fails with a Postgres RLS error, that error is logged with `console.error("Error creating notification:", notifError)` (`pushNotifications.ts:43`) and then **discarded** — `sendPushNotification` still returns `{ success: true }` (line 67), `notifyApplicantStatusChange`'s own `try { } catch` (`OpportunityDashboard.tsx:308‑357`) never sees an error either, and the recruiter's UI shows a normal "Application accepted!" success toast (`OpportunityDashboard.tsx:435‑440`). Nothing in the UI, logs, or monitoring signals that the applicant's notification never landed.

The **same bug fires in the opposite direction** on apply: `ApplyToOpportunityDialog.tsx:161‑166` calls `notifyOpportunity(opportunity.created_by, ...)` as the *applicant*, inserting a notification for the *recruiter* — also blocked by the same policy. So recruiters are silently not being notified of new applicants either; this audit was scoped to the acceptance step, but the same root cause has broader blast radius across the notification system.

**Why email still has a chance, why push still has a chance, why in‑app never does:**
- The `send-transactional-email` edge function (`supabase/functions/send-transactional-email/index.ts`) runs with the service‑role key (lines 43‑50 create the client with `supabaseServiceKey`), so it bypasses RLS entirely — the email *can* go out. But the call site wraps it in `.catch(() => {})` with **zero logging** (`OpportunityDashboard.tsx:334`), so if it fails for any other reason (bad template, suppressed address, queue error) nobody would know that either. It also never checks `notification_preferences.email_opportunities` before sending (contrast with `send-notification-email`, `send-activity-digest`, `send-streak-warning`, `send-weekly-digest`, which do check preferences — grep confirms `send-transactional-email` does not).
- The push‑notification edge function (`supabase/functions/send-push-notification/index.ts:181‑197`) also runs as service role and would succeed in principle, but only reaches devices with a row in `push_subscriptions`, which most applicants won't have granted.
- The in‑app bell (`src/hooks/useNotifications.tsx`, `src/components/NotificationCenter.tsx`, `src/components/project/NotificationBell.tsx`) all read from `public.notifications` (`useNotifications.tsx:74,94,114,178`). Since the row is never written for this event, the bell has nothing to show — this is the channel the applicant actually checks, and it is unconditionally broken for this event.

---

## 4. Root cause (summary)

A March 2026 RLS security fix on `public.notifications` (`supabase/migrations/20260327223242_...sql:1‑10`) correctly restricted `INSERT` to `auth.uid() = user_id OR admin`, but the hire‑acceptance notification path (`src/lib/pushNotifications.ts:26‑45`, called from `src/pages/OpportunityDashboard.tsx:433`) still performs a **direct client‑side insert on behalf of a different user** (the recruiter inserting a notification for the applicant). That insert has been silently rejected by RLS ever since, and the surrounding code has no error propagation: the RLS error is caught and only `console.error`'d, the wrapper function still reports success, and the caller's own try/catch never fires. The applicant only discovers the Studio by manually browsing to `/desk`. This is a **regression introduced by a legitimate, correct security fix that didn't audit its client‑side callers**, not a case of the notification call being missing.

The codebase already has the correct pattern to fix this: several other flows insert cross‑user notifications from **`SECURITY DEFINER` Postgres functions/triggers**, which run with elevated privilege and bypass RLS safely because the function body — not the caller — controls what gets inserted:
- `public.vouch_on_credit` RPC (`supabase/migrations/20260424235925_a17745bc-0bba-40fd-9dca-e1155632e37a.sql:126‑175`, `SECURITY DEFINER`)
- `notify_collaborators_on_credit` trigger (`same file:172‑222`, `SECURITY DEFINER`, fires `AFTER INSERT ON credits`)
- `review-stage-application` edge function using the service‑role client for the insert (`supabase/functions/review-stage-application/index.ts:21,46‑55`) — a separate "Curated Stage" live‑event feature, unrelated to hiring, but architecturally the right shape.

None of that pattern is used for the hire/Studio‑creation path.

---

## 5. Files involved (full list)

**Applicant apply / opportunity view**
- `src/App.tsx:484` — route `/opportunity/:id`
- `src/pages/OpportunityDetail.tsx` — opportunity detail page, apply CTA, own‑application status (lines 246, 763‑792, 819)
- `src/components/ApplyToOpportunityDialog.tsx` — apply form, insert into `applications`, recruiter notification call (lines 91‑98, 128‑166) — **same RLS bug, reverse direction**

**Messaging**
- `supabase/migrations/20250930141941_c6db1045-3991-4a90-8f37-bf98d8083d4e.sql:6‑31` — `messages` table + RLS
- `src/pages/OpportunityDashboard.tsx:814‑840` — `handleMessage`

**Video interview**
- `src/pages/OpportunityDashboard.tsx:807‑812, 1063‑1073` — `handleInterview`, `<VideoCallSheet>`
- `src/hooks/useStartDirectCall.ts:27‑93` — call session state, double‑click guard pattern

**Acceptance + Studio creation (core of the bug)**
- `src/pages/OpportunityDashboard.tsx:360‑460` — `updateApplicationStatus` (status transition, Studio/`projects` insert, `project_collaborators` insert+update, notify call)
- `src/pages/OpportunityDashboard.tsx:301‑358` — `notifyApplicantStatusChange`
- `src/components/opportunity/ApplicantPipeline.tsx:298‑312` — kanban drag‑to‑accept, same handler
- `src/lib/pushNotifications.ts:21‑72` — `sendPushNotification` (in‑app insert + push invoke, silent‑failure site)

**Database**
- `supabase/migrations/20250930141941_c6db1045-3991-4a90-8f37-bf98d8083d4e.sql:33‑61,63‑97` — `applications`, `notifications` table definitions + original RLS
- `supabase/migrations/20251213061246_61ae10db-dba7-49d0-9af7-8771b4c9898c.sql:3‑8` — permissive notifications INSERT policy (superseded)
- `supabase/migrations/20260327223242_5a40d534-9d33-4989-bbd5-95e56ce0b0d9.sql:1‑10` — **current, restrictive notifications INSERT policy (root cause)**
- `supabase/migrations/20250930110444_40cf3801-a539-48d5-820b-23921cd189b2.sql` — original `projects` table + RLS
- `supabase/migrations/20250930155148_308d4931-ae3c-4df2-b39f-84795e377116.sql:2` — adds `projects.created_by`
- `supabase/migrations/20251001113332_9593790c-9050-4880-bbc4-4654a602f753.sql` — `project_collaborators` table, RLS, and updated `projects` SELECT/UPDATE policies keyed on `project_collaborators.status = 'accepted'`
- `supabase/migrations/20251001003256_50e598df-fedc-47e3-b885-2d1eba371e01.sql:11‑41` — `notification_preferences` table + RLS (exists, but not consulted by this flow)
- `supabase/migrations/20260413000526_email_infra.sql:27‑78` — `email_send_log`, its idempotency unique index — the pattern to reuse

**Edge functions**
- `supabase/functions/send-transactional-email/index.ts` — email dispatch, has `idempotencyKey` plumbing (lines 61‑70, 334‑347) but is called with an empty `.catch(() => {})` from the client
- `supabase/functions/send-push-notification/index.ts` — web push dispatch, requires `push_subscriptions` row
- `supabase/functions/review-stage-application/index.ts:21,46‑55` — unrelated feature, cited as reference pattern (service‑role insert)

**Consumption**
- `src/hooks/useNotifications.tsx`, `src/components/NotificationCenter.tsx`, `src/components/project/NotificationBell.tsx` — in‑app bell, all read `notifications` (never populated for this event)
- `src/pages/WorkHome.tsx` — Studio list the applicant has to manually check
- `src/pages/ThriveDesk.tsx` — Studio route, `src/hooks/useProjectData.ts` — RLS‑gated fetch, "Studio not found … you don't have access" fallback (`ThriveDesk.tsx:195‑197`)

**Tests:** none exist for this flow (see §8).

---

## 6. Security impact

- **No unauthorized Studio access found.** `ThriveDesk.tsx` does not do its own authorization — it relies entirely on the `projects` RLS SELECT/UPDATE policies (`20251001113332_...sql:75‑113`), which require either `created_by = auth.uid()` or a `project_collaborators` row with `user_id = auth.uid() AND status = 'accepted'`. Because the client always writes that collaborator row's status to `'accepted'` before treating acceptance as successful, an applicant who was never accepted cannot browse to another user's Studio and get data back — the query simply returns no rows client‑side. This is the correct pattern (authorization enforced server‑side via RLS, not just hidden in the UI).
- **The March 2026 `notifications` RLS fix itself was a real, justified fix** — the prior `WITH CHECK (true)` policy let any authenticated user plant an arbitrary notification (phishing‑style title/link/message) in any other user's feed. Reverting it is not the right fix; the client‑side callers need to move off direct table writes (see §7 Fix Plan).
- **Minor, adjacent finding, not part of the main bug:** `public.applications.status` has no `CHECK` constraint restricting it to `pending|shortlisted|accepted|rejected`, and the UPDATE RLS policy (`20250930141941_...sql:59‑61`) has no `WITH CHECK`, so the opportunity owner can set `status` to any string. `src/components/dashboard/CompanyHiringDashboard.tsx:130` even checks for a `'hired'` value that nothing else in the codebase writes — a latent status‑value drift bug, worth a follow‑up but out of scope here.
- **No evidence of cross‑tenant leakage** in `notification_preferences` or `email_send_log`; both are correctly scoped to `auth.uid()` / service‑role only.

---

## 7. Idempotency / duplicate‑notification risk (found, not hypothetical)

The Accept path is **not idempotent** and has **no guard against re‑triggering**:
- The "Accept" button (`OpportunityDashboard.tsx:1030‑1036`) has no `disabled` state and no in‑flight guard. Contrast this with `useStartDirectCall.ts:31‑48`, which explicitly comments that a fast double‑click "could otherwise fire two create‑call requests" and guards with `inFlightRef` — the exact pattern is absent here.
- `updateApplicationStatus` never checks whether `applicant.status === 'accepted'` already before running the Studio‑creation branch (`OpportunityDashboard.tsx:378‑451`), so re‑invoking it (double click, a second tab, a retried request after a slow network) re‑runs the whole sequence.
- Neither `public.projects` nor `public.project_collaborators` has a unique constraint tying a Studio to its source `application_id`/`opportunity_id`+`applicant_id` — nothing in the schema stops a second `INSERT INTO projects` for the same acceptance. (Compare: `public.applications` does have `UNIQUE(opportunity_id, applicant_id)` at the application level, `20250930141941_...sql:43`, but that only dedupes the *application*, not the *Studio* created from accepting it.)
- `public.notifications` has no unique/idempotency key at all, unlike the email pipeline, which already solved exactly this problem: `email_send_log` has `CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON email_send_log(message_id) WHERE status = 'sent'` (`20260413000526_email_infra.sql:76‑78`) and every `send-transactional-email` call already carries an `idempotencyKey` (e.g. `app-status-${gigId}-${applicantUserId}-${newStatus}`, `OpportunityDashboard.tsx:325`). That convention just isn't mirrored on the `notifications` table or on Studio creation itself.

Net effect: a double‑click on Accept can plausibly create two Studios, two `project_collaborators` invites, and (once the RLS bug is fixed) two duplicate notifications/emails.

---

## 8. Existing test coverage

Searched `**/*.test.ts` and `**/*.test.tsx` repo‑wide (`find src -iname "*.test.ts" -o -iname "*.test.tsx"`): 7 test files exist total —
`src/components/profile/__tests__/BrandPassportHero.test.tsx`, `src/components/search/__tests__/UnifiedSearchDropdown.hero.test.tsx`, `src/lib/__tests__/eventAuthRedirect.test.ts`, `src/lib/__tests__/profileCompletion.test.ts`, `src/lib/__tests__/subscriptionLimits.test.ts`, `src/lib/__tests__/utils.test.ts`, `src/lib/__tests__/validation.test.ts`.

**None** touch `studio`, `accept`, `application`, `project_collaborators`, or `notifications`. There is zero automated coverage of the apply→accept→Studio→notify flow.

---

## 9. Fix plan

Staged, from smallest/safest to full remediation. Every insert below should carry a deterministic idempotency key of the form `studio-created:{studioId}:applicant:{applicantId}`.

**Stage 1 — Stop the silent failure (fast, low‑risk)**
- In `src/lib/pushNotifications.ts:42‑44`, stop swallowing the notification‑insert error: surface it to the caller (return `success:false` with the error) instead of unconditionally returning `{ success: true }` at line 67.
- In `src/pages/OpportunityDashboard.tsx:334` (and the mirrored call in `ApplyToOpportunityDialog.tsx`), replace the bare `.catch(() => {})` with at minimum `.catch((err) => console.error('[accept] email dispatch failed', err))`, and surface a non‑blocking toast/telemetry event if the *notification* step (not the Studio creation) fails, so recruiters and engineers can see it instead of a false‑positive "Application accepted!" success state.
- This alone won't deliver the notification, but it turns a silent failure into a visible, monitorable one immediately.

**Stage 2 — Move the cross‑user notification write server‑side (the actual fix)**
- Add a `SECURITY DEFINER` Postgres function, e.g. `public.create_studio_acceptance_notification(_application_id uuid)`, modeled directly on the existing `public.vouch_on_credit` (`20260424235925_...sql:126‑175`) pattern:
  - validates the caller is the opportunity owner (mirrors the existing `applications` UPDATE RLS check) and that `application.status = 'accepted'`,
  - looks up (or accepts as a parameter) the `studio_id` created for this acceptance,
  - performs the notification insert itself (function body runs as the function owner, bypassing the caller‑scoped RLS safely, because the *function*, not the client, controls the row contents), with a dedupe key.
- Alternatively/additionally, do the whole "accept" transition (`applications.status` update + `projects` insert + `project_collaborators` insert/accept + notification insert) inside **one** `SECURITY DEFINER` RPC, e.g. `public.accept_application(_application_id uuid)`, called from `updateApplicationStatus` instead of the current four sequential client‑side calls (`OpportunityDashboard.tsx:382‑433`). This closes the idempotency gap (§7) and the notification gap (§3) in the same change, and matches the "atomic RPC" pattern already proven in this repo for `consume_copilot_message` / `studio_ai_usage` (`20260819090000_studio_ai_create.sql`).

**Stage 3 — Idempotency**
- Add a unique constraint enabling `ON CONFLICT DO NOTHING` semantics for the notification: either
  - (a) add a `dedupe_key text` column to `public.notifications` with a `UNIQUE` index (nullable elsewhere, populated as `studio-created:{studioId}:applicant:{applicantId}` for this event type), reusing the existing table, or
  - (b) introduce a small outbox table `public.notification_dispatch_log (dedupe_key text PRIMARY KEY, notification_id uuid, channel text, created_at timestamptz)` written to inside the same RPC transaction before the `notifications` insert, checked with `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING` and short‑circuiting if a conflict occurred.
  - Prefer (a) — it's the smaller change and mirrors the already‑proven `idx_email_send_log_message_sent_unique` pattern (`20260413000526_email_infra.sql:76‑78`) instead of introducing a new table.
- Guard `public.projects` / `public.project_collaborators` creation the same way inside the new `accept_application` RPC: `SELECT ... FOR UPDATE` or check for an existing Studio tied to the application before inserting, so a retried/duplicated call is a no‑op on the second attempt (return the existing `studio_id` instead of creating a new one).
- On the client, add the same `inFlightRef`/`disabled` guard already used in `useStartDirectCall.ts:31‑48` to the Accept button (`OpportunityDashboard.tsx:1030‑1036`) as defense in depth, not as the primary fix (client guards don't stop a curl retry or a second browser tab; the DB‑level guard in Stage 3 does).

**Stage 4 — Dispatch in‑app + email per preference**
- Before sending, check `public.notification_preferences` (`email_opportunities` / `in_app_all`) for the applicant, the same way `send-notification-email`/`send-activity-digest`/`send-weekly-digest` already do — `send-transactional-email` and the client‑side push helper currently skip this check entirely for this template.
- Keep using the existing `idempotencyKey` plumbing already built into `send-transactional-email` (`index.ts:61‑70,334‑347`) for the email leg — it already exists and is unused-to-its-potential here; just make sure the key is deterministic (`studio-created:{studioId}:applicant:{applicantId}`, not `app-status-...` which is fine too as long as it's stable across retries, which it already is).

**Stage 5 — Studio‑route authorization check**
- No bypass was found (see §6), but add a defense‑in‑depth explicit check in `ThriveDesk.tsx`/`useProjectData.ts` — after the RLS‑gated fetch returns null, explicitly branch on "not found" vs "exists but not authorized" only if that distinction is ever needed for UX; functionally RLS already prevents unauthorized reads, so this is optional polish, not a required fix.

---

## 10. Verification plan

**Automated (new tests needed — none exist today, see §8)**
1. **RLS unit test** (e.g. via a Supabase test harness / pgTAP or a scripted two‑user Postgres session): as recruiter A, attempt `INSERT INTO notifications (user_id: applicant B, ...)` directly — assert it is rejected (documents the current, intentional restriction so nobody "fixes" it by reverting).
2. **RPC test:** call `public.accept_application(_application_id)` as the opportunity owner; assert: `applications.status = 'accepted'`, exactly one `projects` row created, exactly one `project_collaborators` row with `status='accepted'` for the applicant, exactly one `notifications` row for the applicant with the expected `dedupe_key`.
3. **Duplicate‑acceptance test:** call `accept_application` twice (or concurrently via two async calls) for the same `application_id`; assert still exactly one `projects` row, one `project_collaborators` row, one `notifications` row (no unique‑constraint violation surfaced to the caller — conflict should be swallowed inside the RPC).
4. **Duplicate‑webhook/retry test:** simulate a retried `send-transactional-email` invoke with the same `idempotencyKey`; assert `email_send_log` shows only one `status='sent'` row (already enforced by `idx_email_send_log_message_sent_unique`, but add a regression test since this is the exact mechanism the fix depends on).
5. **Preference‑respecting test:** set `notification_preferences.in_app_all = false` / `email_opportunities = false` for a test applicant, run acceptance, assert the corresponding channel is skipped while the other still fires (or both skipped, per product decision).
6. **Frontend test:** mount `ApplicantCard`, click Accept twice rapidly (simulate double‑click before the first network round trip resolves), assert the accept handler/RPC is invoked once (guard from Stage 3).

**Manual**
1. Two real test accounts (recruiter + applicant). Post an opportunity, apply, message, start a video interview, accept. Confirm: (a) applicant's bell shows the new notification within a few seconds, (b) applicant receives the email, (c) applicant's `/desk` shows the new Studio, (d) clicking the notification deep‑links to `/desk/:projectId` and loads correctly.
2. Repeat, but click Accept twice in quick succession (or reload and click Accept again on an already‑accepted row if the UI allows it) — confirm only one Studio and one notification exist afterward.
3. Confirm the recruiter also gets notified when a new applicant applies (the mirrored bug found in `ApplyToOpportunityDialog.tsx`), since it shares the same root cause and should be fixed by the same RPC‑based approach applied to that path too.
4. Check Supabase function logs / `email_send_log` after a real run to confirm no silent errors are logged where success was reported to the user.
