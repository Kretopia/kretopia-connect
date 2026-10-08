import * as React from 'npm:react@18.3.1'
import { Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, Cta, K } from '../email-kit.tsx'
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
  <KretopiaEmail
    preview={subject}
    eyebrow="Event update"
    title={eventTitle}
    actions={ctaUrl && ctaText ? <Cta href={ctaUrl}>{ctaText}</Cta> : undefined}
    note={
      eventUrl ? (
        <>
          View event details: <Link href={eventUrl} style={{ color: K.muted, wordBreak: 'break-all' }}>{eventUrl}</Link>
        </>
      ) : undefined
    }
  >
    {/* Host-written HTML: set the base colours here so it reads on the dark card. */}
    <div style={{ fontSize: '15px', lineHeight: '24px', color: K.muted }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
  </KretopiaEmail>
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
