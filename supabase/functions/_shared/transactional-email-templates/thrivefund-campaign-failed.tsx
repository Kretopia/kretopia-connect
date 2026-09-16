import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface Props {
  recipientName?: string
  campaignTitle?: string
  isCreator?: boolean
  exploreUrl?: string
}

const CampaignFailedEmail = ({ recipientName, campaignTitle, isCreator, exploreUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on {campaignTitle || 'your ThriveFund campaign'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
        <Heading style={h1}>{isCreator ? 'Campaign closed' : 'Update on your pledge'}</Heading>
        <Text style={text}>
          {recipientName ? `Hey ${recipientName},` : 'Hey,'} <strong>{campaignTitle}</strong> didn't reach its funding goal by the deadline.
        </Text>
        <Text style={text}>
          {isCreator
            ? 'Because ThriveFund is all-or-nothing, no backers were charged. You can refine the pitch, lower the goal, or relaunch when ready — your verified profile and supporters are still here.'
            : 'Because ThriveFund is all-or-nothing, your card was not charged. The authorization will be released by your bank within a few business days.'}
        </Text>
        {exploreUrl && (
          <Button style={button} href={exploreUrl}>
            {isCreator ? 'Plan your relaunch' : 'Explore other campaigns'}
          </Button>
        )}
        <Text style={footer}>Thanks for being part of ThriveFund.</Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CampaignFailedEmail,
  subject: (d: Record<string, any>) =>
    d.isCreator
      ? `Update: ${d.campaignTitle || 'your campaign'} closed without funding`
      : `Update: ${d.campaignTitle || 'a campaign you backed'} didn't fund`,
  displayName: 'ThriveFund — Campaign did not fund',
  previewData: {
    recipientName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    isCreator: false,
    exploreUrl: 'https://www.kretopia.com/fund',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#7B61FF', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, marginBottom: '24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
