import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'
const APP_URL = 'https://www.kretopia.com'
const SETTINGS_URL = 'https://www.kretopia.com/settings'

interface Props {
  name?: string
  /** Injected by send-transactional-email (one-click unsubscribe for this address). */
  unsubscribeUrl?: string
}

const TIPS: Array<{ title: string; body: string }> = [
  {
    title: 'Set up your Passport',
    body: 'Add your role, credits and links so collaborators can see your work in one place.',
  },
  {
    title: 'Start from Today',
    body: 'Today shows your next step. Open a Studio to keep a project’s brief, files, tasks and conversation together.',
  },
  {
    title: 'Look for opportunities in Scout',
    body: 'Scout surfaces opportunities that fit your profile. Always check the source before you apply.',
  },
  {
    title: 'Ask Kreto',
    body: 'Kreto helps you draft pitches, organise a brief and plan follow-ups.',
  },
]

const WelcomeEmail = ({ name, unsubscribeUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — four ways to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />

        <Heading style={h1}>
          {name ? `Welcome, ${name}` : 'Welcome to Kretopia'}
        </Heading>

        <Text style={text}>
          Your account is ready. Here are four ways to get started.
        </Text>

        <Section style={highlightBox}>
          {TIPS.map((tip, i) => (
            <Section key={tip.title} style={i === TIPS.length - 1 ? tipLast : tipRow}>
              <Text style={tipTitle}>{i + 1}. {tip.title}</Text>
              <Text style={tipBody}>{tip.body}</Text>
            </Section>
          ))}
        </Section>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={APP_URL} style={button}>Open Today</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Questions? Just reply to this email.
          <br />— The Kretopia team
        </Text>
        <Text style={footer}>
          You’re receiving this because you created a Kretopia account.{' '}
          <Link href={unsubscribeUrl || SETTINGS_URL} style={footerLink}>
            {unsubscribeUrl ? 'Unsubscribe' : 'Manage email preferences'}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Kretopia',
  displayName: 'Welcome',
  previewData: { name: 'Jane', unsubscribeUrl: 'https://www.kretopia.com/unsubscribe?token=preview' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const highlightBox = { backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '8px 22px', margin: '24px 0' }
const tipRow = { padding: '14px 0', borderBottom: '1px solid #E2E8F0' }
const tipLast = { padding: '14px 0' }
const tipTitle = { fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }
const tipBody = { fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0 }
const button = { backgroundColor: '#5B6BF5', color: '#ffffff', padding: '13px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#E2E8F0', margin: '32px 0 20px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '0 0 10px' }
const footerLink = { color: '#64748B', textDecoration: 'underline' }
