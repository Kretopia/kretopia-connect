import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'

type Status = 'accepted' | 'rejected' | 'shortlisted'

interface Props {
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
  status?: Status
  ownerName?: string
  projectUrl?: string
}

const COPY: Record<Status, { emoji: string; heading: string; intro: (g: string) => string; body: string; cta: string }> = {
  accepted: {
    emoji: '🎉',
    heading: "You're hired!",
    intro: (g) => `Great news — your application for <strong>${g}</strong> was accepted.`,
    body: 'A project workspace has been created so you can chat, share files, and track milestones together. Open it to say hi and get started.',
    cta: 'Open Project Workspace',
  },
  shortlisted: {
    emoji: '⭐',
    heading: "You've been shortlisted",
    intro: (g) => `You made the shortlist for <strong>${g}</strong>.`,
    body: 'The poster is reviewing finalists. Keep an eye on your inbox — they may reach out with questions or to confirm next steps.',
    cta: 'View Gig',
  },
  rejected: {
    emoji: '💛',
    heading: 'Update on your application',
    intro: (g) => `Thanks for applying to <strong>${g}</strong>. The poster has selected a different creator this time.`,
    body: 'Don\'t take it personally — fit matters as much as talent. New gigs drop daily, and a strong profile keeps you top-of-mind.',
    cta: 'Browse New Gigs',
  },
}

const ApplicationStatusUpdateEmail = ({
  applicantName,
  gigTitle = 'this gig',
  gigUrl,
  projectUrl,
  status = 'shortlisted',
}: Props) => {
  const copy = COPY[status] || COPY.shortlisted
  const ctaUrl = status === 'accepted' && projectUrl ? projectUrl : (gigUrl || 'https://www.kretopia.com/opportunities')

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copy.heading} — {gigTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
          <Heading style={h1}>{copy.heading} {copy.emoji}</Heading>
          <Text style={text}>
            {applicantName ? `Hey ${applicantName},` : 'Hey there,'} <span dangerouslySetInnerHTML={{ __html: copy.intro(gigTitle) }} />
          </Text>
          <Text style={text}>{copy.body}</Text>
          <Button style={button} href={ctaUrl}>{copy.cta}</Button>
          <Text style={footer}>
            Track all your applications anytime in your Gig Manager.
          </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ApplicationStatusUpdateEmail,
  subject: (data: Record<string, any>) => {
    const s = data.status as Status
    if (s === 'accepted') return `You're hired: ${data.gigTitle || 'New Gig'}`
    if (s === 'shortlisted') return `Shortlisted: ${data.gigTitle || 'New Gig'}`
    return `Update on your application: ${data.gigTitle || 'New Gig'}`
  },
  displayName: 'Application status update',
  previewData: { applicantName: 'Dee', gigTitle: 'AI Image Creator for Fashion E-commerce', gigUrl: 'https://www.kretopia.com/opportunity/123', status: 'accepted', projectUrl: 'https://www.kretopia.com/desk/abc' },
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
