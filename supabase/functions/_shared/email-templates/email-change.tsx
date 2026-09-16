/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for Kretopia</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt="Kretopia" style={{ marginBottom: '24px', borderRadius: '12px' }} />
        <Heading style={h1}>Confirm your new email</Heading>
        <Text style={eyebrow}>The Creative OS</Text>
        <Text style={text}>
          You requested to change your Kretopia email from{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>
          {' '}to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>. Tap below to confirm.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 32px' }}>
          <Button style={button} href={confirmationUrl}>Confirm email change</Button>
        </Section>
        <Text style={footer}>
          Didn't request this? Please secure your account immediately.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: '900' as const, color: '#0F0F14', margin: '0 0 4px', letterSpacing: '-0.03em' }
const eyebrow = { fontSize: '11px', fontWeight: '900' as const, color: '#7B61FF', margin: '0 0 24px', letterSpacing: '0.18em', textTransform: 'uppercase' as const }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#7B61FF', textDecoration: 'underline' }
const button = { backgroundColor: '#7B61FF', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '0' }
