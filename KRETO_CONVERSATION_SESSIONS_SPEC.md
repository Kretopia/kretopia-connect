# Kreto Conversation Sessions — Spec & Implementation Report

Item 3 in the Kreto Platform Acceleration implementation order: give the `/kreto` page (`InlineKretoChat`) real multi-conversation history, matching what the audit (`KRETO_PLATFORM_ACCELERATION_AUDIT.md`, §D) flagged as a `REQUIRES_PRODUCT_DECISION` gap — the backend already supported an arbitrary `conversation_id`, but every surface hardcoded a single thread per user via `getOrCreateCopilotThread()`.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`. Browser click-through `NOT_CONFIRMED` (same anonymous-session limitation as the P0 round — see below).

## What shipped

### 1. Security fix (prerequisite, found during this work)

[`supabase/functions/thrive-ai-chat/index.ts`](supabase/functions/thrive-ai-chat/index.ts) never verified that a client-supplied `conversation_id` belonged to the caller before using it to hydrate history and persist new turns. The function runs under the service-role client, which bypasses RLS — so this was a real IDOR: an authenticated user who obtained or guessed another user's conversation UUID could read and write into that conversation.

This was latent but harmless while no UI exposed the concept of "pick a conversation ID." Building that UI would have made it trivially exploitable, so it's fixed first: the handler now looks up the conversation's owner and returns `403 {"error": "Conversation not found"}` on any mismatch, for both the normal JWT-auth path and the trusted-service-role (`x-internal-user-id`) path. Rejecting outright (rather than silently falling back to the caller's own thread) means the client never believes it's continuing a conversation it was actually denied.

### 2. Schema

[`supabase/migrations/20260905130000_kreto_conversation_sessions.sql`](supabase/migrations/20260905130000_kreto_conversation_sessions.sql) — the existing `ai_conversations`/`ai_messages` tables and RLS (`20260211172225`) already fully supported multi-conversation CRUD (SELECT/INSERT/UPDATE/DELETE all scoped to `auth.uid() = user_id`, cascading delete on messages). This migration adds only what was missing:
- `ai_conversations.archived_at timestamptz`, nullable — archive-over-delete per the brief, no soft-delete concept existed before.
- A partial index on `(user_id, updated_at desc) where archived_at is null` so listing active conversations stays fast.

No RLS changes, no new tables, no RPCs — everything else is a plain client-side query under existing policies.

### 3. Client data layer

[`src/lib/thriveCopilot.ts`](src/lib/thriveCopilot.ts) — additive only; `streamCopilot`, `loadCopilotHistory`, and `extractActions` (used by `ThriveAgentFab`, the global Copilot sheet) are untouched. New exports: `listConversations`, `createConversation`, `renameConversation`, `archiveConversation`, `deleteConversation`, `loadConversationMessages`.

The pre-existing `'__copilot__'` thread that `ThriveAgentFab` and `getOrCreateCopilotThread()` both key off by exact title is treated as a permanent, pinned entry labeled "Kreto (main)" in the new list — sorted first, and excluded from rename/archive/delete. This was a deliberate choice over the alternatives (hiding it, which would orphan history the P0 fix just restored; or letting it be renamed, which would silently fork `ThriveAgentFab` onto a new `'__copilot__'` row the next time it opens). It keeps the global Copilot sheet's behavior 100% unchanged while still surfacing that same history inside the new sessions UI.

### 4. UI

- [`src/components/kreto/KretoConversationHistory.tsx`](src/components/kreto/KretoConversationHistory.tsx) (new) — a conversation list, rendered as a fixed rail on desktop and a `Sheet` (opened via a "History" button) on mobile via `useIsMobile()`. Search-filters client-side (per-user conversation counts are expected to be small — tens, not thousands — so this is simpler and more responsive than a debounced server round-trip; worth revisiting if that assumption stops holding). Per-conversation rename (inline, Enter/Escape), archive, and delete-with-confirmation (`AlertDialog`), all hidden for the pinned primary thread.
- [`src/components/kreto/InlineKretoChat.tsx`](src/components/kreto/InlineKretoChat.tsx) — now controlled: takes `conversationId: string | null` (`null` = a fresh draft) instead of managing a thread internally. Switching `conversationId` clears and reloads messages. Sending from a draft **lazily** creates the real `ai_conversations` row on first send only — not on "New conversation" click — so changing your mind before typing anything never leaves an abandoned empty row (the brief's explicit requirement).
- [`src/pages/KretoTab.tsx`](src/pages/KretoTab.tsx) — wires `activeConversationId` state and the history rail alongside the chat in a flex row; quick-action seeding moved from a remount-by-`key` trick to a `seedNonce` counter so clicking the same quick action twice still re-sends (a string-keyed effect wouldn't re-fire on an identical value).

## Explicitly out of scope for this round

- Kreto latency/cancellation/reliability hardening (next item in the mandated implementation order).
- Any change to `agent-orchestrator` or the action/plan execution path.
- Server-side search or pagination beyond the 50-conversation / 60-message-per-load caps already in place.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean (pre-existing chunk-size warnings only, unrelated to this change).
- Browser: confirmed (prior P0 round) that `/kreto` renders for anonymous visitors behind a blur-overlay rather than a route redirect, so `loadConversationMessages`/`listConversations` no-op safely for `user === null` and no console errors surface. Full click-through (send → lazy-create → switch conversations → rename/archive/delete) could not be exercised without a signed-in test session and is **not** claimed as verified.

## Deployment steps required (same workflow as every prior change this session)

1. Merge the PR.
2. Apply `20260905130000_kreto_conversation_sessions.sql` via the Lovable Cloud SQL editor.
3. Redeploy the `thrive-ai-chat` edge function via Lovable's chat (the IDOR fix lives there).
4. Confirm live via curl: a request with a `conversation_id` belonging to a different user should now get `403`, not a leaked history.
