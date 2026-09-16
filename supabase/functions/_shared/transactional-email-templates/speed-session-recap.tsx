import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface PersonCard {
  name: string
  role?: string | null
  avatar?: string | null
  profileUrl?: string | null
}

interface Props {
  attendeeName?: string
  sessionTitle?: string
  totalMet?: number
  connected?: PersonCard[]
  savedYou?: PersonCard[]
  met?: PersonCard[]
  browseUrl?: string
}

const Row = ({ p }: { p: PersonCard }) => (
  <Section style={personRow}>
    {p.avatar ? (
      <Img src={p.avatar} width="36" height="36" alt="" style={avatar} />
    ) : (
      <div style={avatarPlaceholder}>{(p.name || '?').slice(0, 1)}</div>
    )}
    <div style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '12px' }}>
      <Text style={personName}>{p.name}</Text>
      {p.role && <Text style={personRole}>{p.role}</Text>}
    </div>
  </Section>
)

const SpeedRecapEmail = ({
  attendeeName,
  sessionTitle = 'Last night\'s Speed Session',
  totalMet = 0,
  connected = [],
  savedYou = [],
  met = [],
  browseUrl = 'https://www.kretopia.com/circle/speed',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      You met {totalMet} {totalMet === 1 ? 'creator' : 'creators'} last night — here's your recap.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '20px' }} />

        <Heading style={h1}>
          {attendeeName ? `Morning, ${attendeeName} 👋` : 'Morning 👋'}
        </Heading>
        <Text style={text}>
          Last night at <strong>{sessionTitle}</strong> you met{' '}
          <strong>{totalMet}</strong> {totalMet === 1 ? 'creator' : 'creators'}.
          Here's where to pick up.
        </Text>

        {connected.length > 0 && (
          <Section style={block}>
            <Text style={blockTitle}>🤝 You connected with</Text>
            {connected.map((p, i) => <Row key={`c-${i}`} p={p} />)}
          </Section>
        )}

        {savedYou.length > 0 && (
          <Section style={block}>
            <Text style={blockTitle}>⭐ Saved you for later</Text>
            <Text style={blockHint}>
              These creators tapped "save" on you. Worth a hello.
            </Text>
            {savedYou.map((p, i) => <Row key={`s-${i}`} p={p} />)}
          </Section>
        )}

        {met.length > 0 && connected.length === 0 && savedYou.length === 0 && (
          <Section style={block}>
            <Text style={blockTitle}>👀 You met</Text>
            <Text style={blockHint}>
              Want to keep one of these going? Open their profile and send a quick note.
            </Text>
            {met.slice(0, 6).map((p, i) => <Row key={`m-${i}`} p={p} />)}
          </Section>
        )}

        <Button style={button} href={browseUrl}>
          See next week's session
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Speed Sessions run weekly. Bring a friend — the more creators in the room, the better the matches.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SpeedRecapEmail,
  subject: (data: Record<string, any>) =>
    `Your recap from ${data.sessionTitle || 'last night\'s Speed Session'}`,
  displayName: 'Speed Session recap',
  previewData: {
    attendeeName: 'Dee',
    sessionTitle: 'Open Creators Night',
    totalMet: 5,
    connected: [{ name: 'Maya Chen', role: 'Director' }],
    savedYou: [{ name: 'Jordan Ali', role: 'Music Producer' }],
    met: [
      { name: 'Maya Chen', role: 'Director' },
      { name: 'Jordan Ali', role: 'Music Producer' },
      { name: 'Sasha P.', role: 'Photographer' },
    ],
    browseUrl: 'https://www.kretopia.com/circle/speed',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const block = { backgroundColor: '#f8f8fc', borderRadius: '12px', padding: '16px 18px', margin: '0 0 16px' }
const blockTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#0a0a0f', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }
const blockHint = { fontSize: '13px', color: '#86868f', margin: '0 0 12px' }
const personRow = { padding: '8px 0' }
const avatar = { borderRadius: '999px', verticalAlign: 'middle' as const, display: 'inline-block' as const }
const avatarPlaceholder = {
  width: '36px', height: '36px', borderRadius: '999px', backgroundColor: '#e5e5ee',
  color: '#0a0a0f', display: 'inline-block' as const, textAlign: 'center' as const,
  lineHeight: '36px', fontWeight: 700, verticalAlign: 'middle' as const,
}
const personName = { fontSize: '14px', fontWeight: '600' as const, color: '#0a0a0f', margin: 0 }
const personRole = { fontSize: '12px', color: '#86868f', margin: 0 }
const button = {
  backgroundColor: '#0a0a0f', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const,
  borderRadius: '12px', padding: '14px 28px', textDecoration: 'none',
  display: 'block' as const, textAlign: 'center' as const, marginTop: '8px',
}
const hr = { borderColor: '#eee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
