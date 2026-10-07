import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const SITE_URL = 'https://www.kretopia.com'
// Brand lockup (K mark + wordmark) from the public asset store, and the Kreto
// mascot served from /public/email. Both are plain https images: email clients
// cannot resolve app-relative URLs or CSS variables.
const LOGO_URL = `${SITE_URL}/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png`
const KRETO_URL = `${SITE_URL}/email/kreto-wave.png`

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

  const claimUrl = attendeeEmail
    ? `${SITE_URL}/auth?mode=signup&email=${encodeURIComponent(attendeeEmail)}&intent=claim_rsvp`
    : `${SITE_URL}/auth?mode=signup&intent=claim_rsvp`
  const qrUrl = checkInToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(checkInToken)}`
    : null

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isTicketed ? 'Your ticket is confirmed' : "You're in"}: {title}. Tap to confirm your attendance.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={topBar} />

          <Section style={logoRow}>
            <Img src={LOGO_URL} width="150" alt={SITE_NAME} style={{ margin: '0 auto' }} />
          </Section>

          <Section style={hero}>
            <Img src={KRETO_URL} width="150" alt="Kreto waving" style={{ margin: '0 auto 8px' }} />
            <Text style={eyebrow}>{isTicketed ? 'Ticket confirmed' : 'Registration confirmed'}</Text>
            <Heading style={h1}>
              Congratulations{firstName ? `, ${firstName}` : ''}.<br />You're going!
            </Heading>
            <Text style={lead}>
              Your spot at <strong style={{ color: '#ffffff' }}>{title}</strong> is saved. Kreto will remind you before it
              starts. All that's left is one tap to confirm you're coming.
            </Text>
            <Button style={primaryButton} href={confirmUrl}>
              Confirm my attendance →
            </Button>
            <Text style={microcopy}>
              {hasAccount && !isGuest
                ? 'You\'ll sign in, then land on the event page with your own profile.'
                : 'You\'ll land on the event page with your pass ready.'}
            </Text>
          </Section>

          <Section style={eventCard}>
            <Text style={cardEyebrow}>The event</Text>
            <Text style={eventTitleStyle}>{title}</Text>
            <table role="presentation" width="100%" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={detailLabelCell}>Date</td>
                  <td style={detailValueCell}>{eventDate || 'To be announced'}</td>
                </tr>
                {eventTime && (
                  <tr>
                    <td style={detailLabelCell}>Time</td>
                    <td style={detailValueCell}>{eventTime}</td>
                  </tr>
                )}
                {eventVenue && (
                  <tr>
                    <td style={detailLabelCell}>Venue</td>
                    <td style={detailValueCell}>{eventVenue}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          {qrUrl && (
            <Section style={qrCard}>
              <Text style={cardEyebrow}>Your check-in pass</Text>
              <Text style={qrHint}>Show this QR code at the door for a quick check-in.</Text>
              <Img src={qrUrl} width="190" height="190" alt="Check-in QR code" style={qrImage} />
              {passUrl && (
                <Link href={passUrl} style={passLink}>
                  Open my pass in Kretopia
                </Link>
              )}
            </Section>
          )}

          {isGuest && (
            <Section style={claimCard}>
              <Text style={claimEyebrow}>Unlock more on {SITE_NAME}</Text>
              <Heading style={claimH2}>Claim your creator profile</Heading>
              <Text style={claimText}>
                Meet the other attendees, get reminders and showcase your work. Free, in 60 seconds.
              </Text>
              <Button style={claimButton} href={claimUrl}>
                Claim my profile →
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Plans changed? You can release your spot any time from the event page. Cancelling takes one tap and frees the
            place for someone on the waitlist.
          </Text>
          <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · Where Creativity Lives · kretopia.com</Text>
        </Container>
      </Body>
    </Html>
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
    passUrl: 'https://www.kretopia.com/event/123/pass?token=abc123preview',
    checkInToken: 'abc123preview',
    isTicketed: false,
    isGuest: false,
    hasAccount: true,
  },
} satisfies TemplateEntry

const PURPLE = '#7b2bf9'
const PINK = '#ee2073'
// Pure black on purpose: the hosted lockup PNG is opaque black, so any other page
// colour shows it as a visible rectangle.
const BG = '#000000'
const CARD = '#111217'
const LINE = '#26252b'

const main = { backgroundColor: BG, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", margin: '0', padding: '0' }
const container = { maxWidth: '520px', margin: '0 auto', backgroundColor: BG, padding: '0 20px 32px' }
const topBar = { height: '4px', background: `linear-gradient(90deg, #5b2cf0 0%, ${PINK} 60%, #ff5521 100%)`, margin: '0 -20px 8px', fontSize: '0', lineHeight: '4px' }
const logoRow = { textAlign: 'center' as const, padding: '24px 0 4px' }
const hero = { textAlign: 'center' as const, padding: '8px 0 28px' }
const eyebrow = { fontSize: '11px', fontWeight: '700' as const, letterSpacing: '2px', textTransform: 'uppercase' as const, color: PINK, margin: '0 0 10px' }
const h1 = { fontSize: '30px', lineHeight: '38px', fontWeight: '800' as const, color: '#ffffff', margin: '0 0 14px' }
const lead = { fontSize: '15px', lineHeight: '24px', color: '#a9a8b6', margin: '0 auto 24px', maxWidth: '420px' }
const primaryButton = {
  backgroundColor: PURPLE,
  backgroundImage: `linear-gradient(90deg, ${PURPLE} 0%, ${PINK} 100%)`,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700' as const,
  borderRadius: '12px',
  padding: '15px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const microcopy = { fontSize: '12px', color: '#6d6c78', margin: '12px 0 0' }
const eventCard = { backgroundColor: CARD, border: `1px solid ${LINE}`, borderTop: `2px solid ${PURPLE}`, borderRadius: '12px', padding: '18px 22px', margin: '0 0 16px' }
const cardEyebrow = { fontSize: '10px', fontWeight: '700' as const, letterSpacing: '1.8px', textTransform: 'uppercase' as const, color: '#7c7e8d', margin: '0 0 6px' }
const eventTitleStyle = { fontSize: '18px', fontWeight: '700' as const, color: '#ffffff', margin: '0 0 12px' }
const detailLabelCell = { fontSize: '11px', fontWeight: '700' as const, letterSpacing: '1px', textTransform: 'uppercase' as const, color: '#7c7e8d', padding: '6px 12px 6px 0', width: '64px', verticalAlign: 'top' as const }
const detailValueCell = { fontSize: '14px', fontWeight: '600' as const, color: '#f2f1f7', padding: '6px 0', verticalAlign: 'top' as const }
const qrCard = { backgroundColor: CARD, border: `1px solid ${LINE}`, borderRadius: '12px', padding: '20px 22px', margin: '0 0 16px', textAlign: 'center' as const }
const qrHint = { fontSize: '13px', color: '#8a8893', margin: '0 0 14px' }
const qrImage = { margin: '0 auto', borderRadius: '12px', backgroundColor: '#ffffff', border: `2px solid ${PURPLE}` }
const passLink = { display: 'inline-block', marginTop: '14px', fontSize: '13px', fontWeight: '700' as const, color: '#c8a6ff', textDecoration: 'underline' }
const claimCard = { backgroundColor: '#100c23', border: '1px solid #302a44', borderRadius: '14px', padding: '24px 22px', margin: '8px 0 0', textAlign: 'center' as const }
const claimEyebrow = { fontSize: '10px', color: '#C6FF00', fontWeight: '700' as const, letterSpacing: '1.8px', textTransform: 'uppercase' as const, margin: '0 0 8px' }
const claimH2 = { fontSize: '20px', fontWeight: '700' as const, color: '#ffffff', margin: '0 0 8px' }
const claimText = { fontSize: '14px', color: '#b8b8c5', lineHeight: '1.5', margin: '0 0 18px' }
const claimButton = { backgroundColor: '#C6FF00', color: BG, fontSize: '14px', fontWeight: '700' as const, borderRadius: '12px', padding: '13px 26px', textDecoration: 'none', display: 'inline-block' as const }
const hr = { borderColor: LINE, margin: '24px 0 16px' }
const footer = { fontSize: '12px', lineHeight: '19px', color: '#8a8893', margin: '0 0 10px', textAlign: 'center' as const }
const footerBrand = { fontSize: '11px', color: '#55545f', margin: '0', textAlign: 'center' as const }
