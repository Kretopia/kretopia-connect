import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, FactRows, Cta, PassQr } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  attendeeName?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  eventVenue?: string
  eventUrl?: string
  checkInToken?: string
  isTicketed?: boolean
}

const EventReminderEmail = ({
  attendeeName,
  eventTitle,
  eventDate,
  eventTime,
  eventVenue,
  eventUrl,
  checkInToken,
}: Props) => {
  const rows = [
    { label: 'Date', value: eventDate || 'TBD' },
    ...(eventTime ? [{ label: 'Time', value: eventTime }] : []),
    ...(eventVenue ? [{ label: 'Venue', value: eventVenue }] : []),
  ]
  return (
    <KretopiaEmail
      preview={`Reminder: "${eventTitle || 'Your event'}" is tomorrow!`}
      eyebrow="Reminder"
      title="⏰ Your Event is Tomorrow!"
      actions={eventUrl ? <Cta href={eventUrl}>View Event Details</Cta> : undefined}
      note="Make sure you've added this to your calendar. See you there! 🎶"
    >
      <P>
        {attendeeName ? `Hey ${attendeeName},` : 'Hey there,'} just a friendly reminder that <B>{eventTitle || 'your event'}</B> is happening tomorrow!
      </P>
      <Panel label="The event">
        <FactRows rows={rows} />
      </Panel>
      {checkInToken && (
        <Panel label="Your Check-In QR Code">
          <P style={{ textAlign: 'center', fontSize: '13px', margin: '0 0 10px' }}>Show this at the door for quick check-in</P>
          <div style={{ textAlign: 'center' }}>
            <PassQr token={checkInToken} />
          </div>
        </Panel>
      )}
    </KretopiaEmail>
  )
}

export const template = {
  component: EventReminderEmail,
  subject: (data: Record<string, any>) =>
    `⏰ Reminder: ${data.eventTitle || 'Your event'} is tomorrow!`,
  displayName: 'Event reminder (24h before)',
  previewData: {
    attendeeName: 'Dee',
    eventTitle: 'Creator Meetup NYC',
    eventDate: 'Saturday, January 25, 2025',
    eventTime: '4:00 PM AST',
    eventVenue: 'The Creative Hub, Brooklyn',
    eventUrl: 'https://www.kretopia.com/event/123',
    checkInToken: '4a9f8cccd3e24b81a0b7c5d6e7f8af9f',
    isTicketed: false,
  },
} satisfies TemplateEntry
