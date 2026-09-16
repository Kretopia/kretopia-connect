import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'
const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
}

const WelcomeEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your creative OS is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />

        <Heading style={h1}>
          {name ? `Welcome, ${name}` : 'Welcome to Kretopia'}
        </Heading>

        <Text style={text}>
          You just joined the creative OS — the home for filmmakers, musicians,
          designers, and creators to showcase verified work, find collaborators,
          and get paid.
        </Text>

        <Section style={highlightBox}>
          <Text style={highlightText}><strong>Get started in 3 steps:</strong></Text>
          <Text style={highlightText}>
            1. Claim your verified credits and build your creative resume{'\n'}
            2. Match with collaborators near you{'\n'}
            3. Browse paid gigs and exchange opportunities
          </Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={APP_URL} style={button}>Open Kretopia</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Questions? Just reply to this email — a real human reads every one.
          <br />— The Kretopia team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Kretopia — your creative OS is ready',
  displayName: 'Welcome',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const highlightBox = { backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '20px 22px', margin: '24px 0' }
const highlightText = { fontSize: '14px', color: '#0F172A', lineHeight: '1.7', margin: '0 0 8px', whiteSpace: 'pre-line' as const }
const button = { backgroundColor: '#5B6BF5', color: '#ffffff', padding: '13px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#E2E8F0', margin: '32px 0 20px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: 0 }
