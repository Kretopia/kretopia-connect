---
name: Personal Room + Booking Page
description: ro.am-style /@handle/room (knock-to-enter) and Calendly-style /@handle/book backed by creator_booking_windows + room_knocks
type: feature
---

## Ownable lexicon
- **Knock** (never "request a call", "join", or "ring")
- **Open my room** (owner action)
- **Book a call** (never "Calendly", never "schedule meeting" in copy)
- **You're on the books.** (booking confirmation copy)

## Routes
- `/@:handle/room` → `src/pages/PersonalRoom.tsx`. Owner: instant room via `create-meeting`. Guest: posts to `knock-personal-room` edge fn, polls `get_knock_status` RPC, auto-redirects to `/meet/:id?t=…` on accept.
- `/@:handle/book` → `src/pages/BookingPage.tsx`. Public. Generates slots client-side from `creator_booking_windows` for next 14 days, filters out blocked dates (`creator_availability_blocks`) and scheduled `meetings`. Books via `book-meeting` edge fn.

## Tables
- `room_knocks` (owner_id, guest_name, guest_token, status, meeting_id, share_url, expires_at 30m). Owner SELECT/UPDATE; anyone INSERT. Realtime enabled.
- `creator_booking_windows` (user_id, weekday 0-6, start_minute, end_minute, slot_minutes, timezone, is_active). Owner CRUD; public SELECT for active rows.
- `profiles.bookings_enabled` boolean — NOT included in `public_profiles_safe` view, so booking page just checks windows.length.

## Edge functions
- `knock-personal-room` (anon ok) — resolves handle → owner, inserts row, writes `notifications` row.
- `accept-room-knock` (auth required) — owner only, creates Daily room + meetings row, stamps knock with share_url.
- `book-meeting` (anon ok) — re-validates slot is inside an active window + no collision, creates scheduled Daily room + meetings row + notification.

## Realtime
- `<RoomKnockToast />` mounted in App.tsx subscribes to INSERT on room_knocks filtered by owner_id; shows sonner toast with "Let them in" / "Decline" actions calling `accept-room-knock`.

## Owner UI
- `BookingWindowsCard` mounted in profile editor's About tab next to `AvailabilityCalendarSection`. Per-weekday windows, slot length 15/30/45/60/90, copy-link, master toggle on `profiles.bookings_enabled`.

## Constraints
- Slots are computed in UTC for window matching; rendered in user's local timezone.
- Booking page tolerates view missing `bookings_enabled` (it's not in `public_profiles_safe`); empty windows = "not opened up yet" empty state.
- Do NOT add `headline` or `bookings_enabled` to `public_profiles_safe` queries — they aren't in the view.
