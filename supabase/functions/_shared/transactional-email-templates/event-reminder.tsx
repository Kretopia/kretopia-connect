import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

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
  isTicketed,
}: Props) => {
  const qrUrl = checkInToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInToken)}`
    : null

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Reminder: "{eventTitle || 'Your event'}" is tomorrow!
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />

          <Heading style={h1}>
            ⏰ Your Event is Tomorrow!
          </Heading>

          <Text style={text}>
            {attendeeName ? `Hey ${attendeeName},` : 'Hey there,'} just a friendly reminder that <strong>{eventTitle || 'your event'}</strong> is happening tomorrow!
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

          <Hr style={hr} />

          <Text style={footer}>
            Make sure you've added this to your calendar. See you there! 🎶
          </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

        </Container>
      </Body>
    </Html>
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
    checkInToken: 'abc123preview',
    isTicketed: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#FFFFFF', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 24px' }
const eventCard = {
  backgroundColor: '#11141B',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
}
const eventDetailLabel = { fontSize: '12px', color: '#7C8393', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const eventDetailValue = { fontSize: '15px', color: '#FFFFFF', fontWeight: '600' as const, margin: '0 0 12px' }
const qrSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const qrLabel = { fontSize: '16px', fontWeight: '600' as const, color: '#FFFFFF', margin: '0 0 4px' }
const qrHint = { fontSize: '13px', color: '#7C8393', margin: '0 0 16px' }
const qrImage = { margin: '0 auto', borderRadius: '8px' }
const button = {
  backgroundColor: '#FFFFFF',
  color: '#05070D',
  fontSize: '14px', lineHeight: '20px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'block' as const,
  textAlign: 'center' as const,
}
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7C8393', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
