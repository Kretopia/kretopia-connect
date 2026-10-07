import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

interface Props {
  backerName?: string
  campaignTitle?: string
  pledgeAmount?: string
  campaignUrl?: string
  deadlineDate?: string
}

const PledgeConfirmedEmail = ({
  backerName, campaignTitle, pledgeAmount, campaignUrl, deadlineDate,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your pledge to {campaignTitle || 'a ThriveFund campaign'} is in</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />
        <Heading style={h1}>🚀 Pledge confirmed</Heading>
        <Text style={text}>
          {backerName ? `Hey ${backerName},` : 'Hey,'} thanks for backing <strong>{campaignTitle}</strong>!
        </Text>
        <Section style={card}>
          <Text style={label}>Your pledge</Text>
          <Text style={value}>{pledgeAmount || '—'}</Text>
          <Text style={label}>How it works</Text>
          <Text style={valueSmall}>
            Your card was authorized — but you'll only be charged if the campaign hits its goal by {deadlineDate || 'the deadline'}.
            If it doesn't reach the goal, the authorization is released and nothing is charged.
          </Text>
        </Section>
        {campaignUrl && (
          <Button style={button} href={campaignUrl}>View campaign</Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>You're helping a verified creator bring real work to life. 💜</Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PledgeConfirmedEmail,
  subject: (d: Record<string, any>) => `Pledge confirmed: ${d.campaignTitle || 'ThriveFund'}`,
  displayName: 'ThriveFund — Pledge confirmed',
  previewData: {
    backerName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    pledgeAmount: '$50.00',
    campaignUrl: 'https://www.kretopia.com/fund/brooklyn-tides',
    deadlineDate: 'May 15, 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#FFFFFF', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#11141B', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px' }
const label = { fontSize: '12px', color: '#7C8393', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const value = { fontSize: '20px', color: '#FF2DA1', fontWeight: '700' as const, margin: '0 0 16px' }
const valueSmall = { fontSize: '14px', color: '#FFFFFF', margin: '0 0 4px', lineHeight: '1.5' }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', fontSize: '14px', lineHeight: '20px', fontWeight: '600' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const }
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7C8393', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
