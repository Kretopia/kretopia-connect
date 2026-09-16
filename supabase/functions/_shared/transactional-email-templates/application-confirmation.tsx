import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

interface Props {
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
}

const ApplicationConfirmationEmail = ({ applicantName, gigTitle, gigUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your application for "{gigTitle || 'a gig'}" has been submitted</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Application Submitted! 🎉</Heading>
        <Text style={text}>
          {applicantName ? `Hey ${applicantName},` : 'Hey there,'} your application for <strong>{gigTitle || 'this gig'}</strong> has been successfully submitted.
        </Text>
        <Text style={text}>
          The creator will review your application and get back to you. You can track the status of all your applications in your Gig Manager.
        </Text>
        {gigUrl && (
          <Button style={button} href={gigUrl}>
            View Gig Details
          </Button>
        )}
        <Text style={footer}>
          Keep building your portfolio — verified credits and reviews help you stand out. ✨
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApplicationConfirmationEmail,
  subject: (data: Record<string, any>) => `Application submitted: ${data.gigTitle || 'New Gig'}`,
  displayName: 'Application confirmation',
  previewData: { applicantName: 'Dee', gigTitle: 'AI Image Creator for Fashion E-commerce', gigUrl: 'https://www.kretopia.com/opportunity/123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto', borderTop: '4px solid #C6FF00' }
const h1 = { fontSize: '26px', fontWeight: '900' as const, color: '#0F0F14', margin: '0 0 16px', letterSpacing: '-0.03em' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const button = {
  backgroundColor: '#7B61FF',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  boxShadow: '0 4px 14px #7B61FF55',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
