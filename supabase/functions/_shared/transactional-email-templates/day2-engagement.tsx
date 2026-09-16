import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'
const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
  gigCount?: number
  profileViews?: number
  role?: string
}

const Day2EngagementEmail = ({ name, gigCount = 0, profileViews = 0, role }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {gigCount > 0
        ? `${gigCount} new opportunities match your profile`
        : `Your profile is gaining traction on Kretopia`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />

        <Heading style={h1}>
          {name ? `${name}, here's what's happening` : "Here's what's happening"}
        </Heading>

        <Text style={text}>
          You joined Kretopia a couple of days ago. Here's the snapshot of your network so far.
        </Text>

        <Section style={statsBox}>
          {profileViews > 0 && (
            <Text style={statLine}>
              <strong style={{ color: '#7B61FF' }}>{profileViews}</strong> {profileViews === 1 ? 'person has' : 'people have'} viewed your profile
            </Text>
          )}
          {gigCount > 0 && (
            <Text style={statLine}>
              <strong style={{ color: '#7B61FF' }}>{gigCount}</strong> active gig{gigCount === 1 ? '' : 's'} match{gigCount === 1 ? 'es' : ''} {role ? `your "${role}" role` : 'your profile'}
            </Text>
          )}
          {!profileViews && !gigCount && (
            <Text style={statLine}>
              Your verified credits are live and indexed. Boost discovery by sharing your profile link or applying to a gig.
            </Text>
          )}
        </Section>

        <Button style={button} href={`${APP_URL}/?utm_source=lifecycle&utm_campaign=day2`}>
          {gigCount > 0 ? 'See matching gigs' : 'Open Kretopia'}
        </Button>

        <Text style={subtext}>
          One unread message can turn into a paid project. Don't keep collaborators waiting.
        </Text>

        <Text style={footer}>
          The Kretopia Team
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Day2EngagementEmail,
  subject: (data: Record<string, any>) =>
    data.gigCount > 0
      ? `${data.gigCount} gig${data.gigCount === 1 ? '' : 's'} match your profile`
      : `Your week on Kretopia`,
  displayName: 'Day-2 engagement nudge',
  previewData: { name: 'Marlon', gigCount: 3, profileViews: 12, role: 'Photographer' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const statsBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  borderLeft: '4px solid #7B61FF',
}
const statLine = { fontSize: '14px', color: '#3a3a44', lineHeight: '1.6', margin: '0 0 8px' }
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
const subtext = { fontSize: '13px', color: '#999999', margin: '12px 0 32px', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', whiteSpace: 'pre-line' as const }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
