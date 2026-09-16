/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your email to get started on Kretopia</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} width="48" height="48" alt="Kretopia" style={{ borderRadius: '12px' }} />
        </Section>

        <Heading style={h1}>Welcome to Kretopia</Heading>
        <Text style={eyebrow}>The Creative OS</Text>

        <Text style={text}>
          You're one step away from joining the professional creative network. Verify your email to claim verified credits, apply to real gigs, and unlock your dashboard.
        </Text>

        <Text style={text}>
          Confirm <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>:
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>Verify & get started</Button>
        </Section>

        <Text style={footer}>
          If you didn't sign up for Kretopia, you can safely ignore this email.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const h1 = { fontSize: '26px', fontWeight: '900' as const, color: '#0F0F14', margin: '0 0 4px', letterSpacing: '-0.03em' }
const eyebrow = { fontSize: '11px', fontWeight: '900' as const, color: '#7B61FF', margin: '0 0 24px', letterSpacing: '0.18em', textTransform: 'uppercase' as const }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#7B61FF', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '8px 0 32px' }
const button = { backgroundColor: '#7B61FF', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '0' }
