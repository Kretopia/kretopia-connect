# Global UI Wrap Polish — Report (P2, scoped to Events + Messages)

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED` for Events. `AUDITED`, no changes needed for Messages. `BROWSER_VERIFIED` not possible for the Events change — no public event currently exists in this database to click through.

Per the user's explicit scope for this P2 pass: Events and Messages only, not all 14 surfaces listed in the brief.

## Events — `EventCommunityHub.tsx`: wrapped into tabs

**Problem**: the event detail page (`EventPage.tsx` → `EventCommunityHub`) stacked four distinct, unrelated content surfaces vertically, all visible and all mounted at once: the guest roster, a group-chat management card, the full inline group chat (a real chat interface), and the full comment thread (list + composer). A visitor had to scroll past a complete chat UI just to reach the comments, and past the comments to reach the post-event "continue as a Circle" bridge. This is precisely the "wall of cards" pattern the brief's P2 section names directly.

**Fix**: reused `StudioSectionTabs` (`src/components/studio-reference/StudioSectionTabs.tsx`) — the same accessible, Radix-based tab primitive already proven in the prior UX round for `Recordings.tsx` and `StageGrid.tsx` — to switch between three peer content categories instead of stacking them:

- **Who's Going** (`{count}`) — the guest roster
- **Chat** — the group-chat card plus the inline chat, together (they're one coherent concern: the chat card is how the host enables/manages the group chat the inline view then shows)
- **Comments** — the comment thread

`ContinueAsCircle` (the post-event bridge) stays outside the tabs, always visible when `isPast`, since it's a one-time call-to-action rather than a content category a user would want to switch back to.

**What's preserved, exactly**:
- Every existing conditional gate (`guestMatchingEnabled`, `isAuthenticated`, the inline-chat's stricter `groupChatEnabled && groupChatRoomId && currentUserId && (isCreator || isParticipant)` check) is unchanged — it now gates whether a *tab* appears instead of whether a *section* appears, but the logic itself is untouched.
- No new backend calls, no new state lifted, no props changed on any of the four wrapped child components.
- If only one tab would exist (e.g. `guestMatchingEnabled` is false and the viewer isn't authenticated, leaving only Comments), the component skips the tab bar entirely and renders that single tab's content directly — avoiding an odd single-tab UI.
- Deep-link/query-param support: `StudioSectionTabs`'s `queryParam="crew"` means a link like `/event/:id?crew=chat` opens directly to the Chat tab — new capability, free from the existing primitive, not something added specifically here.

**What changed for the user**: they now see one content category at a time, switchable via a tab bar, instead of scrolling through all of them stacked. On mobile this meaningfully shortens the page. Keyboard navigation, ARIA tab semantics, and focus management all come from the underlying Radix Tabs component (already used and already accessible elsewhere in this codebase) — not reimplemented.

## Messages — audited, no changes made

Read `Messages.tsx` and `ConversationListPanel.tsx` in full. This page is **already** built exactly the way the brief's P2 section asks for: a real Radix `Tabs` component already switches between Direct/Groups/Calls/Requests (`ConversationListPanel.tsx:75-86`), each with its own loading/empty/error state, unread and missed-call badges, and a responsive master-detail layout that correctly hides the conversation list on mobile once a conversation is open. There is no stacked "wall of cards" here to wrap — the page is a conversation view, which is expected to scroll through message history by nature, not a dashboard of many independent cards.

**No changes made.** Inventing a restructure here would have been "refactoring a noncritical feature that doesn't need it," which the brief explicitly warns against.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: not possible for the Events change — the local database currently has zero public events (`/meetup` shows "No events yet" after clearing a stale search filter), so `/event/:id` cannot be reached with real data in this environment. High confidence regardless: `StudioSectionTabs` is the exact same, already-shipped-and-working primitive used elsewhere, and every existing conditional was moved, not altered.
- Messages required no code change, so there is nothing new to verify there beyond confirming (via direct code reading) that its existing tab/empty/loading states are real and already working.

## Deployment steps required

None. Frontend-only change, no migration, no edge function.
