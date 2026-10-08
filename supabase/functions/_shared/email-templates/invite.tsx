/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to Kretopia</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />
        <Heading style={h1}>You're invited</Heading>
        <Text style={eyebrow}>The Creative OS</Text>
        <Text style={text}>
          Someone on <Link href={siteUrl} style={link}><strong>Kretopia</strong></Link> thinks you'd be a great addition to the professional creative network. Accept to claim your credits, set up your profile, and start getting booked.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 32px' }}>
          <Button style={button} href={confirmationUrl}>Accept invitation</Button>
        </Section>
        <Text style={footer}>
          Wasn't expecting this? Just ignore this email.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: '900' as const, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.03em' }
const eyebrow = { fontSize: '11px', fontWeight: '900' as const, color: '#FF2DA1', margin: '0 0 24px', letterSpacing: '0.18em', textTransform: 'uppercase' as const }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#C9CEDA', textDecoration: 'underline' }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', fontSize: '14px', lineHeight: '20px', fontWeight: '600' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#7C8393', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '0' }
