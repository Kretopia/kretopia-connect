import * as React from 'npm:react@18.3.1'
import { Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, P, B, Small, Panel, Fact, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  attendeeName?: string
  stageTitle?: string
  /** "rsvp" (a spot) or "waitlist" (no spot yet). */
  status?: 'rsvp' | 'waitlist'
  /** The start time in UTC, e.g. "Thu 17 Dec 2026, 20:00 UTC"; the Stage page shows the reader's own time zone. */
  startsWhen?: string
  hostName?: string | null
  stageUrl?: string
  googleCalendarUrl?: string
  /** A paid ticket: the email says it is paid. No "free up your spot" link: cancelling does not refund it. */
  ticket?: boolean
  /** "12.00 EUR", as Stripe reported the payment. */
  paidAmount?: string
}

/**
 * Sent once when someone registers for a scheduled Stage (or joins its waitlist), and once when a paid ticket seats them.
 * Says what is true: no spot is promised to the waitlist, and nothing is said about refunds.
 */
const StageRegistrationConfirmation = ({
  attendeeName,
  stageTitle = 'the Stage',
  status = 'rsvp',
  startsWhen = 'Soon',
  hostName,
  stageUrl = 'https://www.kretopia.com/circle',
  googleCalendarUrl,
  ticket = false,
  paidAmount,
}: Props) => {
  const link = { color: K.white, textDecoration: 'underline' } as const
  const waitlist = !ticket && status === 'waitlist'
  return (
    <KretopiaEmail
      preview={waitlist ? `You're on the waitlist for ${stageTitle}` : `${ticket ? 'Ticket confirmed' : "You're in"} for ${stageTitle} · ${startsWhen}`}
      eyebrow={ticket ? 'Stage ticket' : 'Stage'}
      title={waitlist ? "You're on the waitlist" : ticket ? 'Your ticket is confirmed' : "You're in"}
      actions={
        <>
          <Cta href={stageUrl}>Open the Stage</Cta>
          {!waitlist && googleCalendarUrl && (
            <Small style={{ margin: '10px 0 0' }}>
              <Link href={googleCalendarUrl} style={link}>Add it to Google Calendar</Link>
            </Small>
          )}
        </>
      }
      note={
        <>
          {waitlist
            ? "We'll let you know in Kretopia if a spot opens. "
            : ticket
              ? 'Kretopia reminds you 24 h, 1 h and 15 min before.'
              : "Kretopia reminds you 24 h, 1 h and 15 min before. Can't make it? "}
          {!waitlist && !ticket && <Link href={stageUrl} style={link}>Free up your spot</Link>}
        </>
      }
    >
      <P>
        {attendeeName ? `${attendeeName}, ` : ''}
        {waitlist
          ? <>the Stage <B>{stageTitle}</B> is full right now, so you're on its waitlist. Nothing is reserved yet.</>
          : ticket
            ? <>your ticket for <B>{stageTitle}</B> is paid and your spot is saved.</>
            : <>your spot at <B>{stageTitle}</B> is saved.</>}
      </P>
      <Panel>
        <Fact label="When">{startsWhen}</Fact>
        {ticket && paidAmount && <Fact label="Paid">{paidAmount}</Fact>}
        {hostName && <Fact label="Host">{hostName}</Fact>}
        <Fact label="Where">Online, on Kretopia. The doors open when the host goes live.</Fact>
      </Panel>
    </KretopiaEmail>
  )
}

export const template = {
  component: StageRegistrationConfirmation,
  subject: (data: Record<string, unknown>) =>
    data.ticket
      ? `Your ticket for ${data.stageTitle || 'the Stage'}`
      : data.status === 'waitlist'
        ? `You're on the waitlist for ${data.stageTitle || 'the Stage'}`
        : `You're in for ${data.stageTitle || 'the Stage'}`,
  displayName: 'Stage registration confirmed',
  previewData: {
    attendeeName: 'Dee',
    stageTitle: 'Night Shoot Showcase',
    status: 'rsvp',
    startsWhen: 'Thu 17 Dec 2026, 20:00 UTC',
    hostName: 'Ana Lima',
    stageUrl: 'https://www.kretopia.com/circle/stage/123',
    googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Night',
  },
} satisfies TemplateEntry
