import { supabase } from "@/integrations/supabase/client";

interface SendEventConfirmationParams {
  eventId: string;
  eventTitle: string;
  startTime: string;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  isTicketed?: boolean;
  participantId: string;
}

export const sendEventConfirmationEmail = async ({
  eventId,
  eventTitle,
  startTime,
  endTime,
  venueName,
  venueAddress,
  isTicketed,
  participantId,
}: SendEventConfirmationParams) => {
  try {
    // Get the participant's check_in_token and user email
    const { data: participant } = await supabase
      .from('jam_participants')
      .select('check_in_token, user_id')
      .eq('id', participantId)
      .single();

    if (!participant) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    // Always format in the event's local timezone (Trinidad/Caribbean default)
    // TODO: store timezone per event for multi-region support
    const eventTimezone = 'America/Port_of_Spain';

    const eventDate = new Date(startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: eventTimezone,
    });

    const eventTime = new Date(startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: eventTimezone,
    });

    const venue = venueName
      ? venueAddress
        ? `${venueName}, ${venueAddress}`
        : venueName
      : undefined;

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'event-registration-confirmation',
        recipientEmail: user.email,
        // "-v2": every send under the previous key failed (sender_domain_mismatch, Aug 17 to Oct 7), and the
        // email API refuses to retry a failed key ("already failed, send again with a new idempotency key").
        // Nobody got a message under it, so a new suffix cannot duplicate one; it only unblocks re-sends.
        idempotencyKey: `event-reg-v2-${eventId}-${user.id}`,
        templateData: {
          attendeeName: profile?.full_name || undefined,
          eventTitle,
          eventDate,
          eventTime,
          eventVenue: venue,
          eventUrl: `https://www.kretopia.com/event/${eventId}`,
          checkInToken: participant.check_in_token,
          attendeeEmail: user.email,
          isTicketed: !!isTicketed,
          hasAccount: true,
        },
      },
    });
  } catch (err) {
    console.error('Failed to send event confirmation email:', err);
    // Don't throw - email failure shouldn't break the join flow
  }
};
