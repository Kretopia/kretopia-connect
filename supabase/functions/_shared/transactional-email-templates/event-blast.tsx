import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface EventBlastProps {
  subject?: string
  bodyHtml?: string
  eventTitle?: string
  eventUrl?: string
  ctaText?: string
  ctaUrl?: string
}

const EventBlastEmail = ({
  subject = 'Update from your event host',
  bodyHtml = '',
  eventTitle = 'Your Event',
  eventUrl,
  ctaText,
  ctaUrl,
}: EventBlastProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Kretopia</Heading>
          <Text style={eyebrow}>EVENT UPDATE</Text>
        </Section>
        <Heading style={h1}>{eventTitle}</Heading>
        <Section style={content}>
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </Section>
        {ctaUrl && ctaText && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={ctaUrl} style={button}>{ctaText}</Button>
          </Section>
        )}
        {eventUrl && (
          <>
            <Hr style={hr} />
            <Text style={footer}>
              View event details:{' '}
              <a href={eventUrl} style={link}>{eventUrl}</a>
            </Text>
          </>
        )}
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventBlastEmail,
  subject: (data: Record<string, any>) => data?.subject || 'Update from your event host',
  displayName: 'Event Blast',
  previewData: {
    subject: 'Reminder: doors open at 7pm',
    eventTitle: 'Studio Session w/ Local Producers',
    bodyHtml: '<p>Hey! Quick reminder that our event starts soon. See you there.</p>',
    eventUrl: 'https://www.kretopia.com/event/sample',
    ctaText: 'View Event',
    ctaUrl: 'https://www.kretopia.com/event/sample',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const header = { marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }
const eyebrow = { fontSize: '11px', fontWeight: 700, color: '#7B61FF', margin: 0, letterSpacing: '0.15em' }
const h1 = { fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 20px', lineHeight: 1.2 }
const content = { fontSize: '15px', color: '#334155', lineHeight: 1.6, margin: '0 0 20px' }
const button = { backgroundColor: '#C6FF00', color: '#0F172A', padding: '12px 28px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#64748B', margin: 0 }
const link = { color: '#7B61FF', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
