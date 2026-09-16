import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

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
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
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

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#f8f8fc', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px' }
const label = { fontSize: '12px', color: '#999', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const value = { fontSize: '24px', color: '#7B61FF', fontWeight: '700' as const, margin: '0 0 16px' }
const valueSmall = { fontSize: '15px', color: '#0a0a0f', fontWeight: '600' as const, margin: '0 0 4px' }
const button = { backgroundColor: '#7B61FF', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const }
const hr = { borderColor: '#eee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
