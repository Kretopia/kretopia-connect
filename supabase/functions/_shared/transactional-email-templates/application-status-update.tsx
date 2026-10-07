import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

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
          <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto 28px' }} />
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

const main = { backgroundColor: '#000000', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto',}
const h1 = { fontSize: '26px', fontWeight: '900' as const, color: '#FFFFFF', margin: '0 0 16px', letterSpacing: '-0.03em' }
const text = { fontSize: '15px', color: '#A8B0C0', lineHeight: '1.6', margin: '0 0 24px' }
const button = {
  backgroundColor: '#FFFFFF',
  color: '#05070D',
  fontSize: '14px', lineHeight: '20px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 32px',
  textDecoration: 'none',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
}
const footer = { fontSize: '12px', color: '#7C8393', margin: '32px 0 0' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
