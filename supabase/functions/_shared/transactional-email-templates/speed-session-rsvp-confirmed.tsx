import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

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
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're in for {sessionTitle} · {startsWhen}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />

        <Heading style={h1}>You're in 🎉</Heading>
        <Text style={text}>
          {attendeeName ? `Locked in, ${attendeeName}. ` : 'Locked in. '}
          See you at <strong>{sessionTitle}</strong> · {startsWhen}.
        </Text>

        <Section style={card}>
          <Text style={label}>Format</Text>
          <Text style={value}>
            Meet a fresh creator every {slotMinutes} min · {mode} · {durationMin} min total
          </Text>
          {theme && (
            <>
              <Text style={label}>Vibe</Text>
              <Text style={value}>{theme}</Text>
            </>
          )}
        </Section>

        {googleCalendarUrl && (
          <Button style={button} href={googleCalendarUrl}>
            Add to Google Calendar
          </Button>
        )}

        <Text style={tip}>
          We'll ping you again 24h, 1h, and 10 min before. The lobby opens 15 min early — drop in and warm up.
        </Text>

        <Hr style={hr} />
        <Text style={subhead}>While you wait</Text>
        <Text style={text}>
          1. <Link href={sessionUrl} style={footerLink}>Open the session page</Link> and share it with a friend — better matches happen with 6+ in the room.
          {'\n'}2. Polish your profile (avatar + role + bio) so people remember you after the call.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Can't make it? <Link href={sessionUrl} style={footerLink}>Cancel your RSVP</Link> so we can match someone else.
        </Text>
        <Text style={footer}>
          Questions? <Link href="mailto:info@kretopia.com" style={footerLink}>info@kretopia.com</Link>
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

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

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#FFFFFF', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 20px', whiteSpace: 'pre-line' as const }
const subhead = { fontSize: '13px', fontWeight: '700' as const, color: '#FFFFFF', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }
const card = { backgroundColor: '#11141B', borderRadius: '12px', padding: '16px 18px', margin: '0 0 20px' }
const label = { fontSize: '11px', fontWeight: '700' as const, color: '#7C8393', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }
const value = { fontSize: '14px', color: '#FFFFFF', margin: '0 0 10px', fontWeight: '500' as const }
const button = {
  backgroundColor: '#FFFFFF', color: '#05070D', fontSize: '14px', lineHeight: '20px', fontWeight: '600' as const,
  borderRadius: '16px', padding: '14px 32px', textDecoration: 'none',
  display: 'block' as const, textAlign: 'center' as const, marginTop: '8px',
}
const tip = { fontSize: '12px', color: '#7C8393', margin: '16px 0 0', lineHeight: '1.5' }
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7C8393', margin: '0' }
const footerLink = { color: '#FFFFFF', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
