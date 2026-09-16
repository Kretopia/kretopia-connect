import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface Props {
  attendeeName?: string
  sessionTitle?: string
  startsWhen?: string  // "Tomorrow at 8 PM EST"
  whenLabel?: 'tomorrow' | 'in_one_hour' | 'starting_soon'
  durationMin?: number
  slotMinutes?: number
  mode?: 'video' | 'audio'
  theme?: string | null
  sessionUrl?: string
  rsvpCount?: number
  isGroupMode?: boolean
}

const headlines = {
  tomorrow: '🗓 Tomorrow — your Speed Session',
  in_one_hour: '⏰ Starts in 1 hour',
  starting_soon: '🚨 Starting in 10 min',
} as const

const previews = {
  tomorrow: (t: string) => `"${t}" is on tomorrow. Add it to your calendar so you don't forget.`,
  in_one_hour: (t: string) => `"${t}" kicks off in 60 minutes. Open the lobby and warm up.`,
  starting_soon: (t: string) => `"${t}" starts in 10. Open the room and hit "I'm here".`,
}

const SpeedReminder = ({
  attendeeName,
  sessionTitle = 'Speed Session',
  startsWhen = 'Soon',
  whenLabel = 'starting_soon',
  durationMin = 60,
  slotMinutes = 5,
  mode = 'video',
  theme,
  sessionUrl = 'https://www.kretopia.com/circle/speed',
  rsvpCount,
  isGroupMode,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{previews[whenLabel](sessionTitle)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '20px' }} />
        <Heading style={h1}>{headlines[whenLabel]}</Heading>
        <Text style={text}>
          {attendeeName ? `Hey ${attendeeName} — ` : ''}<strong>{sessionTitle}</strong> · {startsWhen}.
        </Text>

        {isGroupMode && (
          <Section style={notice}>
            <Text style={noticeTitle}>Heads up — tonight runs as an open group call</Text>
            <Text style={noticeBody}>
              Fewer than 5 RSVPs, so instead of rotating pairs you'll meet everyone together in one room. Same time, same link.
            </Text>
          </Section>
        )}

        <Section style={card}>
          <Text style={label}>Format</Text>
          <Text style={value}>
            {isGroupMode
              ? `Open group call · ${mode} · ${durationMin} min`
              : `${slotMinutes} min per match · ${mode} · ${durationMin} min total`}
          </Text>
          {theme && (
            <>
              <Text style={label}>Vibe</Text>
              <Text style={value}>{theme}</Text>
            </>
          )}
          {typeof rsvpCount === 'number' && rsvpCount > 0 && (
            <>
              <Text style={label}>Who's coming</Text>
              <Text style={value}>{rsvpCount} {rsvpCount === 1 ? 'creator' : 'creators'} so far</Text>
            </>
          )}
        </Section>

        <Button style={button} href={sessionUrl}>
          {whenLabel === 'tomorrow' ? 'Open session' : "Open the room"}
        </Button>

        <Text style={tip}>
          {whenLabel === 'tomorrow'
            ? 'Pro tip: a complete profile (avatar + role + bio) lifts your match quality. Takes 2 mins.'
            : whenLabel === 'in_one_hour'
            ? 'The lobby opens 15 min early — drop in, warm up, see who else is on.'
            : "When you land on the page, tap \"I'm here\" to enter the matching pool."}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Can't make it? <Link href={sessionUrl} style={footerLink}>Cancel your RSVP</Link> so we can match someone else.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SpeedReminder,
  subject: (data: Record<string, any>) => {
    const t = data.sessionTitle || 'your Speed Session'
    if (data.whenLabel === 'tomorrow') return `Tomorrow: ${t}`
    if (data.whenLabel === 'in_one_hour') return `Starting in 1 hour: ${t}`
    return `Starting in 10 min: ${t}`
  },
  displayName: 'Speed Session reminder',
  previewData: {
    attendeeName: 'Dee',
    sessionTitle: 'Open Creators Night',
    startsWhen: 'Tomorrow at 8 PM EST',
    whenLabel: 'tomorrow' as const,
    durationMin: 60,
    slotMinutes: 5,
    mode: 'video' as const,
    theme: 'Anyone with a creative bone',
    sessionUrl: 'https://www.kretopia.com/circle/speed/123',
    rsvpCount: 8,
    isGroupMode: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#3a3a44', lineHeight: '1.6', margin: '0 0 20px' }
const notice = { backgroundColor: '#fff8e6', border: '1px solid #ffe1a1', borderRadius: '12px', padding: '14px 16px', margin: '0 0 16px' }
const noticeTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#7a4a00', margin: '0 0 4px' }
const noticeBody = { fontSize: '13px', color: '#7a4a00', margin: '0', lineHeight: '1.5' }
const card = { backgroundColor: '#f8f8fc', borderRadius: '12px', padding: '16px 18px', margin: '0 0 20px' }
const label = { fontSize: '11px', fontWeight: '700' as const, color: '#86868f', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }
const value = { fontSize: '14px', color: '#0a0a0f', margin: '0 0 10px', fontWeight: '500' as const }
const button = {
  backgroundColor: '#0a0a0f', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const,
  borderRadius: '12px', padding: '14px 28px', textDecoration: 'none',
  display: 'block' as const, textAlign: 'center' as const, marginTop: '8px',
}
const tip = { fontSize: '12px', color: '#86868f', margin: '16px 0 0', lineHeight: '1.5' }
const hr = { borderColor: '#eee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#86868f', margin: '0' }
const footerLink = { color: '#0a0a0f', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
