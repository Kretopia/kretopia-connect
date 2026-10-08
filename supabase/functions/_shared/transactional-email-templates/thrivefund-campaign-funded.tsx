import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

interface Props {
  recipientName?: string
  campaignTitle?: string
  totalRaised?: string
  backerCount?: number
  isCreator?: boolean
  campaignUrl?: string
}

const CampaignFundedEmail = ({
  recipientName, campaignTitle, totalRaised, backerCount, isCreator, campaignUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{campaignTitle || 'A ThriveFund campaign'} is fully funded! 🎉</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />
        <Heading style={h1}>🎉 It's funded!</Heading>
        <Text style={text}>
          {recipientName ? `Hey ${recipientName},` : 'Hey,'} <strong>{campaignTitle}</strong> hit its goal.
        </Text>
        <Section style={card}>
          <Text style={label}>Total raised</Text>
          <Text style={value}>{totalRaised || '—'}</Text>
          <Text style={label}>Backers</Text>
          <Text style={valueSmall}>{backerCount ?? 0}</Text>
        </Section>
        <Text style={text}>
          {isCreator
            ? 'The first milestone tranche has been released to your connected payout account. The rest unlocks as you mark milestones complete.'
            : 'Your card has been charged for the pledged amount. The creator now has the funds to bring this work to life — they\'ll keep you posted with updates.'}
        </Text>
        {campaignUrl && (
          <Button style={button} href={campaignUrl}>View campaign</Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>This is what verified crowdfunding looks like. 💜</Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CampaignFundedEmail,
  subject: (d: Record<string, any>) => `🎉 Funded: ${d.campaignTitle || 'ThriveFund campaign'}`,
  displayName: 'ThriveFund — Campaign funded',
  previewData: {
    recipientName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    totalRaised: '$12,450',
    backerCount: 187,
    isCreator: false,
    campaignUrl: 'https://www.kretopia.com/fund/brooklyn-tides',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#FFFFFF', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#11141B', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px' }
const label = { fontSize: '12px', color: '#7C8393', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const value = { fontSize: '24px', color: '#FF2DA1', fontWeight: '700' as const, margin: '0 0 16px' }
const valueSmall = { fontSize: '15px', color: '#FFFFFF', fontWeight: '600' as const, margin: '0 0 4px' }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', fontSize: '14px', lineHeight: '20px', fontWeight: '600' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const }
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7C8393', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
