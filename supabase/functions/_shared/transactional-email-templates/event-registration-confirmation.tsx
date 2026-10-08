import * as React from 'npm:react@18.3.1'
import { Img } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, KRETO_WAVE_URL, SITE_URL, P, B, Small, Panel, FactRows, Cta, Ghost, PassQr } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  attendeeName?: string
  attendeeEmail?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  eventVenue?: string
  eventUrl?: string
  passUrl?: string
  checkInToken?: string
  isTicketed?: boolean
  isGuest?: boolean
  /** Registered member: the confirm button signs them in, then lands on the event as themselves. */
  hasAccount?: boolean
}

const EventRegistrationConfirmationEmail = ({
  attendeeName,
  attendeeEmail,
  eventTitle,
  eventDate,
  eventTime,
  eventVenue,
  eventUrl,
  passUrl,
  checkInToken,
  isTicketed,
  isGuest,
  hasAccount,
}: Props) => {
  const title = eventTitle || 'this event'
  const firstName = attendeeName ? attendeeName.trim().split(/\s+/)[0] : undefined

  // The confirmation loop: one tap confirms the spot and lands on the event page.
  // Members go through sign-in first (returns to the event as their own profile);
  // guests land on the event with their pass already attached.
  const eventPath = eventUrl || SITE_URL
  const eventId = eventUrl ? eventUrl.split('/event/')[1]?.split(/[?#/]/)[0] : undefined
  const confirmUrl = hasAccount && !isGuest && eventId
    ? `${SITE_URL}/auth?event=${encodeURIComponent(eventId)}&tab=signin&source=email`
    : `${eventPath}${eventPath.includes('?') ? '&' : '?'}rsvp=confirmed&source=email${
        attendeeEmail ? `&email=${encodeURIComponent(attendeeEmail)}` : ''
      }${attendeeName ? `&name=${encodeURIComponent(attendeeName)}` : ''}${
        checkInToken ? `&token=${encodeURIComponent(checkInToken)}` : ''
      }`

  const rows = [
    { label: 'Date', value: eventDate || 'To be announced' },
    ...(eventTime ? [{ label: 'Time', value: eventTime }] : []),
    ...(eventVenue ? [{ label: 'Venue', value: eventVenue }] : []),
  ]

  return (
    <KretopiaEmail
      preview={`${isTicketed ? 'Your ticket is confirmed' : "You're in"}: ${title}. Tap to confirm your attendance.`}
      eyebrow={isTicketed ? 'Ticket confirmed' : 'Registration confirmed'}
      title={<>Congratulations{firstName ? `, ${firstName}` : ''}.<br />You're going!</>}
      hero={<Img src={KRETO_WAVE_URL} width="130" alt="Kreto waving" style={{ margin: '0 auto' }} />}
      note="Plans changed? You can release your spot any time from the event page. Cancelling takes one tap and frees the place for someone on the waitlist."
    >
      <P style={{ textAlign: 'center' }}>
        Your spot at <B>{title}</B> is saved. Kreto will remind you before it starts. All that's left is one tap to confirm you're coming.
      </P>
      <div style={{ textAlign: 'center' }}>
        <Cta href={confirmUrl}>Confirm my attendance →</Cta>
        <Small style={{ margin: '0 0 18px' }}>
          {hasAccount && !isGuest
            ? "You'll sign in, then land on the event page with your own profile."
            : "You'll land on the event page with your pass ready."}
        </Small>
      </div>
      <Panel label="The event">
        <div style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>{title}</div>
        <FactRows rows={rows} />
      </Panel>
      {passUrl || checkInToken ? (
        <Panel label="Your check-in pass">
          <div style={{ textAlign: 'center' }}>
            <Small style={{ margin: '0 0 10px' }}>Show this QR code at the door for a quick check-in.</Small>
            <PassQr token={checkInToken} />
            {passUrl && <Ghost href={passUrl}>Open my pass in Kretopia</Ghost>}
          </div>
        </Panel>
      ) : null}
    </KretopiaEmail>
  )
}

export const template = {
  component: EventRegistrationConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data.isTicketed
      ? `Ticket confirmed: ${data.eventTitle || 'Event'}`
      : `You're going to ${data.eventTitle || 'the event'}. Confirm your attendance`,
  displayName: 'Event registration confirmation',
  previewData: {
    attendeeName: 'Dee Marshall',
    attendeeEmail: 'dee@example.com',
    eventTitle: 'Creator Meetup NYC',
    eventDate: 'Saturday, January 25, 2025',
    eventTime: '7:00 PM EST',
    eventVenue: 'The Creative Hub, Brooklyn',
    eventUrl: 'https://www.kretopia.com/event/123',
    passUrl: 'https://www.kretopia.com/event/123/pass?token=4a9f8cccd3e24b81a0b7c5d6e7f8af9f',
    checkInToken: '4a9f8cccd3e24b81a0b7c5d6e7f8af9f',
    isTicketed: false,
    isGuest: false,
    hasAccount: true,
  },
} satisfies TemplateEntry
