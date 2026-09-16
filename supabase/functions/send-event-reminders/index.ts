import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

// Trinidad timezone for formatting
const EVENT_TIMEZONE = 'America/Port_of_Spain'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[EVENT-REMINDERS] Missing env vars')
    return new Response(JSON.stringify({ error: 'Server config error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Find events starting between 23 and 25 hours from now
    // This window ensures we catch events even if cron runs slightly off-schedule
    const now = new Date()
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    console.log(`[EVENT-REMINDERS] Checking for events between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`)

    const { data: events, error: eventsError } = await supabase
      .from('creative_jams')
      .select('id, title, start_time, end_time, venue_name, venue_address, is_ticketed')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .in('status', ['active', 'upcoming'])

    if (eventsError) {
      console.error('[EVENT-REMINDERS] Error fetching events:', eventsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!events || events.length === 0) {
      console.log('[EVENT-REMINDERS] No events found in 24h window')
      return new Response(JSON.stringify({ success: true, reminders_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[EVENT-REMINDERS] Found ${events.length} event(s) to send reminders for`)

    let totalSent = 0

    for (const event of events) {
      // Get all participants for this event
      const { data: participants, error: partError } = await supabase
        .from('jam_participants')
        .select('id, user_id, check_in_token')
        .eq('jam_id', event.id)

      if (partError) {
        console.error(`[EVENT-REMINDERS] Error fetching participants for event ${event.id}:`, partError)
        continue
      }

      if (!participants || participants.length === 0) {
        console.log(`[EVENT-REMINDERS] No participants for event ${event.id}`)
        continue
      }

      // Format event time in local timezone
      const eventDate = new Date(event.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: EVENT_TIMEZONE,
      })

      const eventTime = new Date(event.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: EVENT_TIMEZONE,
      })

      const venue = event.venue_name
        ? event.venue_address
          ? `${event.venue_name}, ${event.venue_address}`
          : event.venue_name
        : undefined

      console.log(`[EVENT-REMINDERS] Sending reminders for "${event.title}" to ${participants.length} participant(s)`)

      for (const participant of participants) {
        // Get user email and profile
        const { data: authUser } = await supabase.auth.admin.getUserById(participant.user_id)
        if (!authUser?.user?.email) {
          console.warn(`[EVENT-REMINDERS] No email for user ${participant.user_id}`)
          continue
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', participant.user_id)
          .single()

        const idempotencyKey = `event-reminder-24h-${event.id}-${participant.user_id}`

        // Check if we already sent this reminder (avoid duplicates on re-runs)
        const { data: existingLog } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('message_id', idempotencyKey)
          .maybeSingle()

        if (existingLog) {
          console.log(`[EVENT-REMINDERS] Already sent reminder for event ${event.id} to ${authUser.user.email}`)
          continue
        }

        // Cross-function idempotency: event-reminders (the newer, more
        // complete reminder dispatcher) tracks the exact same
        // (event_id, user_id, reminder_24h, email) tuple in this same
        // table on success. Check it here too, so attendees never get both
        // functions' 24h email if they're ever scheduled at the same time.
        const { data: alreadyClaimed } = await supabase
          .from('event_reminders_sent')
          .select('id')
          .eq('event_id', event.id)
          .eq('user_id', participant.user_id)
          .eq('reminder_type', 'reminder_24h')
          .eq('channel', 'email')
          .maybeSingle()
        if (alreadyClaimed) {
          console.log(`[EVENT-REMINDERS] Reminder already sent via event-reminders for event ${event.id}, user ${participant.user_id} — skipping`)
          continue
        }

        try {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'event-reminder',
              recipientEmail: authUser.user.email,
              idempotencyKey,
              templateData: {
                attendeeName: profile?.full_name || undefined,
                eventTitle: event.title,
                eventDate,
                eventTime,
                eventVenue: venue,
                eventUrl: `https://thrivein.io/event/${event.id}`,
                checkInToken: participant.check_in_token,
                isTicketed: !!event.is_ticketed,
              },
            },
          })
          totalSent++
          // Record the claim so event-reminders skips this user/event if it
          // also runs. A duplicate-key conflict here just means the other
          // function claimed it first in a narrow race — harmless to ignore.
          const { error: claimErr } = await supabase
            .from('event_reminders_sent')
            .insert({ event_id: event.id, user_id: participant.user_id, reminder_type: 'reminder_24h', channel: 'email' })
          if (claimErr && claimErr.code !== '23505') {
            console.error(`[EVENT-REMINDERS] Failed to record reminder claim:`, claimErr)
          }
        } catch (err) {
          console.error(`[EVENT-REMINDERS] Failed to send reminder to ${authUser.user.email}:`, err)
        }
      }
    }

    console.log(`[EVENT-REMINDERS] Done. Sent ${totalSent} reminder(s)`)

    return new Response(JSON.stringify({ success: true, reminders_sent: totalSent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[EVENT-REMINDERS] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
