import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface Props {
  ownerName?: string
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
}

const NewApplicantNotificationEmail = ({ ownerName, applicantName, gigTitle, gigUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New application for "{gigTitle || 'your gig'}"</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
        <Heading style={h1}>New Application Received 📩</Heading>
        <Text style={text}>
          {ownerName ? `Hey ${ownerName},` : 'Hey there,'} <strong>{applicantName || 'Someone'}</strong> has applied to your gig: <strong>{gigTitle || 'your listing'}</strong>.
        </Text>
        <Text style={text}>
          Head over to your Gig Manager to review their application, cover letter, and portfolio.
        </Text>
        {gigUrl && (
          <Button style={button} href={gigUrl}>
            Review Application
          </Button>
        )}
        <Text style={footer}>
          Manage all your gigs and applicants from your Gig Manager anytime.
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewApplicantNotificationEmail,
  subject: (data: Record<string, any>) => `New application: ${data.gigTitle || 'Your Gig'}`,
  displayName: 'New applicant notification',
  previewData: { ownerName: 'Ethan', applicantName: 'Dee McRae', gigTitle: 'AI Image Creator for Fashion E-commerce', gigUrl: 'https://www.kretopia.com/opportunity/123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const button = {
  backgroundColor: '#7B61FF',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 8px' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '0' }
