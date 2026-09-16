import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface Props {
  attendeeName?: string
  attendeeEmail?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  eventVenue?: string
  eventUrl?: string
  checkInToken?: string
  isTicketed?: boolean
  isGuest?: boolean
}

const EventRegistrationConfirmationEmail = ({
  attendeeName,
  attendeeEmail,
  eventTitle,
  eventDate,
  eventTime,
  eventVenue,
  eventUrl,
  checkInToken,
  isTicketed,
  isGuest,
}: Props) => {
  const claimUrl = attendeeEmail
    ? `https://www.kretopia.com/auth?mode=signup&email=${encodeURIComponent(attendeeEmail)}&intent=claim_rsvp`
    : 'https://www.kretopia.com/auth?mode=signup&intent=claim_rsvp'
  const qrUrl = checkInToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInToken)}`
    : null

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isTicketed ? 'Your ticket' : 'You\'re registered'} for "{eventTitle || 'an event'}" on {SITE_NAME}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />

          <Heading style={h1}>
            {isTicketed ? '🎫 Ticket Confirmed!' : '✅ You\'re Registered!'}
          </Heading>

          <Text style={text}>
            {attendeeName ? `Hey ${attendeeName},` : 'Hey there,'} you're all set for <strong>{eventTitle || 'this event'}</strong>!
          </Text>

          <Section style={eventCard}>
            <Text style={eventDetailLabel}>📅 Date</Text>
            <Text style={eventDetailValue}>{eventDate || 'TBD'}</Text>

            {eventTime && (
              <>
                <Text style={eventDetailLabel}>🕐 Time</Text>
                <Text style={eventDetailValue}>{eventTime}</Text>
              </>
            )}

            {eventVenue && (
              <>
                <Text style={eventDetailLabel}>📍 Venue</Text>
                <Text style={eventDetailValue}>{eventVenue}</Text>
              </>
            )}
          </Section>

          {qrUrl && (
            <Section style={qrSection}>
              <Text style={qrLabel}>Your Check-In QR Code</Text>
              <Text style={qrHint}>Show this at the door for quick check-in</Text>
              <Img src={qrUrl} width="200" height="200" alt="Check-in QR Code" style={qrImage} />
            </Section>
          )}

          {eventUrl && (
            <Button style={button} href={eventUrl}>
              View Event Details
            </Button>
          )}

          {isGuest && (
            <Section style={claimCard}>
              <Text style={claimEyebrow}>★ Unlock more on {SITE_NAME}</Text>
              <Heading style={claimH2}>Claim your creator profile</Heading>
              <Text style={claimText}>
                Connect with attendees, get reminders, and showcase your work — free, in 60 seconds.
              </Text>
              <Button style={claimButton} href={claimUrl}>
                Claim my profile →
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Add this to your calendar so you don't miss it! See you there. 🎶
          </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventRegistrationConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data.isTicketed
      ? `🎫 Ticket confirmed: ${data.eventTitle || 'Event'}`
      : `✅ You're registered: ${data.eventTitle || 'Event'}`,
  displayName: 'Event registration confirmation',
  previewData: {
    attendeeName: 'Dee',
    attendeeEmail: 'dee@example.com',
    eventTitle: 'Creator Meetup NYC',
    eventDate: 'Saturday, January 25, 2025',
    eventTime: '7:00 PM EST',
    eventVenue: 'The Creative Hub, Brooklyn',
    eventUrl: 'https://www.kretopia.com/event/123',
    checkInToken: 'abc123preview',
    isTicketed: false,
    isGuest: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const eventCard = {
  backgroundColor: '#f8f8fc',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
}
const eventDetailLabel = { fontSize: '12px', color: '#999', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const eventDetailValue = { fontSize: '15px', color: '#0a0a0f', fontWeight: '600' as const, margin: '0 0 12px' }
const qrSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const qrLabel = { fontSize: '16px', fontWeight: '600' as const, color: '#0a0a0f', margin: '0 0 4px' }
const qrHint = { fontSize: '13px', color: '#999', margin: '0 0 16px' }
const qrImage = { margin: '0 auto', borderRadius: '8px' }
const button = {
  backgroundColor: '#7B61FF',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'block' as const,
  textAlign: 'center' as const,
}
const hr = { borderColor: '#eee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
const claimCard = {
  background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1530 100%)',
  borderRadius: '16px',
  padding: '28px 24px',
  margin: '32px 0 0',
  textAlign: 'center' as const,
}
const claimEyebrow = {
  fontSize: '11px',
  color: '#C6FF00',
  fontWeight: '700' as const,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
}
const claimH2 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0 0 8px' }
const claimText = { fontSize: '14px', color: '#b8b8c5', lineHeight: '1.5', margin: '0 0 20px' }
const claimButton = {
  backgroundColor: '#C6FF00',
  color: '#0a0a0f',
  fontSize: '15px',
  fontWeight: '700' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
