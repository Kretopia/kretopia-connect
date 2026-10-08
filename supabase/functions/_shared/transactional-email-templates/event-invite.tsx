import * as React from 'npm:react@18.3.1'
import { Img, Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, Panel, Quote, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface EventInviteProps {
  eventTitle?: string
  eventUrl?: string
  hostName?: string
  startTimeFormatted?: string
  venue?: string
  coverImageUrl?: string
  personalNote?: string
}

const EventInviteEmail = ({
  eventTitle = 'A Kretopia event',
  eventUrl = 'https://www.kretopia.com',
  hostName = 'Your host',
  startTimeFormatted,
  venue,
  coverImageUrl,
  personalNote,
}: EventInviteProps) => (
  <KretopiaEmail
    preview={`${hostName} invited you to ${eventTitle}`}
    eyebrow="You're invited"
    title={eventTitle}
    subtitle={`Hosted by ${hostName}`}
    actions={<Cta href={eventUrl}>RSVP & view details</Cta>}
    note={
      <>
        Or open this link: <Link href={eventUrl} style={{ color: K.muted, wordBreak: 'break-all' }}>{eventUrl}</Link>
      </>
    }
  >
    {coverImageUrl && (
      <Img src={coverImageUrl} alt={eventTitle} width="470" style={{ width: '100%', height: 'auto', borderRadius: '16px', margin: '0 0 14px' }} />
    )}
    {(startTimeFormatted || venue) && (
      <Panel>
        {startTimeFormatted && <div style={{ margin: '4px 0', fontSize: '14px', fontWeight: 500, color: K.white }}>📅 {startTimeFormatted}</div>}
        {venue && <div style={{ margin: '4px 0', fontSize: '14px', fontWeight: 500, color: K.white }}>📍 {venue}</div>}
      </Panel>
    )}
    {personalNote && <Quote>"{personalNote}"</Quote>}
  </KretopiaEmail>
)

export const template = {
  component: EventInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.hostName
      ? `${data.hostName} invited you to ${data?.eventTitle ?? 'an event'}`
      : `You're invited: ${data?.eventTitle ?? 'a Kretopia event'}`,
  displayName: 'Event Invite',
  previewData: {
    eventTitle: 'Studio Session w/ Local Producers',
    hostName: 'Maya from Kretopia',
    startTimeFormatted: 'Sat, May 4 · 7:00 PM',
    venue: 'Soho Loft, NYC',
    eventUrl: 'https://www.kretopia.com/event/sample',
    personalNote: 'Would love to have you in the room.',
  },
} satisfies TemplateEntry
