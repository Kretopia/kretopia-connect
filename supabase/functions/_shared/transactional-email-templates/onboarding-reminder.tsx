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
}

const OnboardingReminderEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your creative profile is almost ready — finish setting up in 2 minutes</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
        
        <Heading style={h1}>
          {name ? `${name}, you're almost there` : "You're almost there"}
        </Heading>
        
        <Text style={text}>
          You started setting up your Kretopia profile yesterday — and we saved your progress. Just a couple more steps and you'll be visible to creators, brands, and collaborators worldwide.
        </Text>

        <Section style={highlightBox}>
          <Text style={highlightText}>
            <strong>Here's what's waiting for you:</strong>
          </Text>
          <Text style={highlightText}>
            🎯 Get matched with creators who complement your skills{'\n'}
            📍 Discover sessions, meetups and gigs near you{'\n'}
            🏆 Build your verified creative resume
          </Text>
        </Section>

        <Button style={button} href={`${APP_URL}/onboarding`}>
          Complete Your Profile
        </Button>

        <Text style={subtext}>
          Takes less than 2 minutes — we'll walk you through it.
        </Text>

        <Text style={footer}>
          See you on the other side,{'\n'}
          The Kretopia Team
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OnboardingReminderEmail,
  subject: "Your creative profile is 90% done — let's finish it",
  displayName: 'Onboarding reminder (24h)',
  previewData: { name: 'Marlon' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const highlightBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  borderLeft: '4px solid #5B6BF5',
}
const highlightText = { fontSize: '14px', color: '#3a3a44', lineHeight: '1.8', margin: '0 0 8px', whiteSpace: 'pre-line' as const }
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
