import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

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
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${hostName} invited you to ${eventTitle}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 0 14px' }} />
          <Text style={eyebrow}>YOU'RE INVITED</Text>
        </Section>

        {coverImageUrl && (
          <Img src={coverImageUrl} alt={eventTitle} width="512" style={cover} />
        )}

        <Heading style={h1}>{eventTitle}</Heading>
        <Text style={hostLine}>Hosted by {hostName}</Text>

        {(startTimeFormatted || venue) && (
          <Section style={metaBox}>
            {startTimeFormatted && (
              <Text style={metaLine}>📅 {startTimeFormatted}</Text>
            )}
            {venue && <Text style={metaLine}>📍 {venue}</Text>}
          </Section>
        )}

        {personalNote && (
          <Section style={noteBox}>
            <Text style={noteText}>"{personalNote}"</Text>
          </Section>
        )}

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={eventUrl} style={button}>RSVP & view details</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Or open this link: <a href={eventUrl} style={link}>{eventUrl}</a>
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
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

const main = { backgroundColor: '#000000', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const header = { marginBottom: '20px' }
const eyebrow = { fontSize: '11px', fontWeight: 700, color: '#FF2DA1', margin: 0, letterSpacing: '0.15em' }
const cover = { width: '100%', height: 'auto', borderRadius: '12px', margin: '0 0 20px', objectFit: 'cover' as const }
const h1 = { fontSize: '26px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.2 }
const hostLine = { fontSize: '14px', color: '#7C8393', margin: '0 0 16px' }
const metaBox = { backgroundColor: '#11141B', borderRadius: '10px', padding: '12px 16px', margin: '0 0 16px' }
const metaLine = { fontSize: '14px', color: '#FFFFFF', margin: '4px 0', fontWeight: 500 }
const noteBox = { backgroundColor: '#11141B', border: '1px solid #1A1E28', borderRadius: '12px', padding: '12px 16px', margin: '16px 0' }
const noteText = { fontSize: '15px', color: '#A8B0C0', fontStyle: 'italic' as const, margin: 0, lineHeight: 1.5 }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', padding: '14px 32px', borderRadius: '16px', fontWeight: '600' as const, fontSize: '14px', lineHeight: '20px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#7C8393', margin: 0 }
const link = { color: '#C9CEDA', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
