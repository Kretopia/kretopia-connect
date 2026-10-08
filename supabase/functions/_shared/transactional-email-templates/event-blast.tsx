import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button, Img, } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png'

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
          <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 0 14px' }} />
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

const main = { backgroundColor: '#000000', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const header = { marginBottom: '24px' }
const eyebrow = { fontSize: '11px', fontWeight: 700, color: '#FF2DA1', margin: 0, letterSpacing: '0.15em' }
const h1 = { fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 20px', lineHeight: 1.2 }
const content = { fontSize: '15px', color: '#A8B0C0', lineHeight: 1.6, margin: '0 0 20px' }
const button = { backgroundColor: '#FFFFFF', color: '#05070D', padding: '14px 32px', borderRadius: '16px', fontWeight: '600' as const, fontSize: '14px', lineHeight: '20px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#1A1E28', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#7C8393', margin: 0 }
const link = { color: '#C9CEDA', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#55545F', margin: '12px 0 0' }
