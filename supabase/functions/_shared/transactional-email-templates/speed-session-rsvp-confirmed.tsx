import * as React from 'npm:react@18.3.1'
import { Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, P, B, Small, Panel, Fact, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  attendeeName?: string
  sessionTitle?: string
  startsWhen?: string
  durationMin?: number
  slotMinutes?: number
  mode?: 'video' | 'audio'
  theme?: string | null
  sessionUrl?: string
  googleCalendarUrl?: string
  icsUrl?: string
}

const RsvpConfirmed = ({
  attendeeName,
  sessionTitle = 'Speed Session',
  startsWhen = 'Soon',
  durationMin = 60,
  slotMinutes = 5,
  mode = 'video',
  theme,
  sessionUrl = 'https://www.kretopia.com/circle/speed',
  googleCalendarUrl,
}: Props) => {
  const link = { color: K.white, textDecoration: 'underline' } as const
  return (
    <KretopiaEmail
      preview={`You're in for ${sessionTitle} · ${startsWhen}`}
      eyebrow="Speed Session"
      title="You're in 🎉"
      actions={
        <>
          {googleCalendarUrl && <Cta href={googleCalendarUrl}>Add to Google Calendar</Cta>}
          <Small style={{ margin: '6px 0 0' }}>
            We'll ping you again 24h, 1h, and 10 min before. The lobby opens 15 min early — drop in and warm up.
          </Small>
        </>
      }
      note={
        <>
          Can't make it? <Link href={sessionUrl} style={link}>Cancel your RSVP</Link> so we can match someone else.
        </>
      }
    >
      <P>
        {attendeeName ? `Locked in, ${attendeeName}. ` : 'Locked in. '}
        See you at <B>{sessionTitle}</B> · {startsWhen}.
      </P>

      <Panel>
        <Fact label="Format">Meet a fresh creator every {slotMinutes} min · {mode} · {durationMin} min total</Fact>
        {theme && <Fact label="Vibe">{theme}</Fact>}
      </Panel>

      <Panel label="While you wait">
        <P style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-line' }}>
          1. <Link href={sessionUrl} style={link}>Open the session page</Link> and share it with a friend — better matches happen with 6+ in the room.
          {'\n'}2. Polish your profile (avatar + role + bio) so people remember you after the call.
        </P>
      </Panel>
    </KretopiaEmail>
  )
}

export const template = {
  component: RsvpConfirmed,
  subject: (data: Record<string, any>) => `You're in for ${data.sessionTitle || 'the Speed Session'}`,
  displayName: 'Speed Session RSVP confirmed',
  previewData: {
    attendeeName: 'Dee',
    sessionTitle: 'Open Creators Night',
    startsWhen: 'Friday at 8 PM EST',
    durationMin: 60,
    slotMinutes: 5,
    mode: 'video' as const,
    theme: 'Anyone with a creative bone',
    sessionUrl: 'https://www.kretopia.com/circle/speed/123',
    googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Speed',
  },
} satisfies TemplateEntry
