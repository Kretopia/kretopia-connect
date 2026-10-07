import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'
const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
  daysInactive?: number
  activeGigsCount?: number
}

const ReEngagementEmail = ({ name, activeGigsCount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A quick note from Ethan, founder of Kretopia</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />

        <Heading style={h1}>
          {name ? `${name}, here's what's new` : "Here's what's new on Kretopia"}
        </Heading>
        <Text style={eyebrow}>The Creative OS</Text>

        <Text style={text}>
          I'm Ethan, founder of Kretopia. You're one of our early creators — wanted to share what's live since you last stopped by.
        </Text>

        <Section style={highlightBox}>
          <Text style={highlightHeading}>🔥 Live right now</Text>
          <Text style={highlightText}>
            • <strong>{activeGigsCount ?? 'Several'} active gigs</strong> from brands and creators<br />
            • <strong>Smart Matching</strong> pairs you by skill and intent<br />
            • <strong>AI Verification</strong> builds trust on your profile
          </Text>
        </Section>

        <Text style={text}>
          These features only kick in once your profile is active. Step back inside and see who you match with this week.
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/opportunities`} style={button}>
            See live gigs →
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={smallText}>
          Your feedback shapes what we build next. Hit reply or message me directly:<br />
          <strong>WhatsApp:</strong> +62 811 399 6510 · <strong>Email:</strong> thriveinapp@gmail.com
        </Text>

        <Text style={signature}>
          Thanks for being early.<br /><br />
          Ethan Auguste<br />
          <span style={{ color: '#A8B0C0' }}>Founder, Kretopia</span>
        </Text>

        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReEngagementEmail,
  subject: 'A quick note from Ethan, founder of Kretopia',
  displayName: 'Re-engagement (dormant users)',
  previewData: { name: 'Jane', daysInactive: 14, activeGigsCount: 14 },
} satisfies TemplateEntry

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '14px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 16px' }
const highlightBox = { backgroundColor: '#11141B', border: '1px solid #1A1E28', padding: '20px 22px', borderRadius: '8px', margin: '20px 0' }
const highlightHeading = { fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 10px' }
const highlightText = { fontSize: '14px', color: '#A8B0C0', lineHeight: '1.8', margin: '0' }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', padding: '14px 32px', borderRadius: '16px', fontWeight: '600' as const, fontSize: '14px', lineHeight: '20px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#1A1E28', margin: '28px 0' }
const signature = { fontSize: '15px', color: '#FFFFFF', lineHeight: '1.6', margin: '24px 0 0' }
const eyebrow = { fontSize: '11px', fontWeight: '900' as const, color: '#FF2DA1', margin: '0 0 20px', letterSpacing: '0.18em', textTransform: 'uppercase' as const }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '24px 0 0' }
