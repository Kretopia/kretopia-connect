/**
 * Who may see whom in an event's list of people going.
 *
 * A member can hide themselves from an event's attendee list (the "visible to other attendees" switch on a session's participants, stored
 * as jam_participants.is_visible = false); they are told "Only the host can see you". So a hidden row is shown to the host and to the member
 * themselves, and to nobody else. A guest RSVP (no account) is stored visible and is listed like any other row. Every list of an event's
 * people on the Event page (the avatar stack, the participants modal, the crew list) applies this one rule.
 */
export interface ParticipantVisibilityRow {
  user_id: string | null;
  is_visible?: boolean | null;
}

export function participantVisibleTo(row: ParticipantVisibilityRow, viewerId: string | null | undefined, viewerIsHost: boolean): boolean {
  if (viewerIsHost) return true;
  if (row.is_visible !== false) return true;
  return !!viewerId && row.user_id === viewerId;
}

/**
 * The same rule as a PostgREST `or` filter, so a hidden row is not even sent to a viewer who may not see it. Null for the host, who reads
 * every row. The viewer id is checked to be a plain uuid before it is put in the filter.
 */
export function participantVisibilityFilter(viewerId: string | null | undefined, viewerIsHost: boolean): string | null {
  if (viewerIsHost) return null;
  const own = viewerId && /^[0-9a-f-]{36}$/i.test(viewerId) ? `,user_id.eq.${viewerId}` : "";
  return `is_visible.is.null,is_visible.eq.true${own}`;
}
