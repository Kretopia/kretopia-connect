import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

type Status = 'accepted' | 'rejected' | 'shortlisted'

interface Props {
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
  status?: Status
  ownerName?: string
  projectUrl?: string
}

const COPY: Record<Status, { emoji: string; heading: string; intro: (g: string) => React.ReactNode; body: string; cta: string }> = {
  accepted: {
    emoji: '🎉',
    heading: "You're hired!",
    intro: (g) => <>Great news — your application for <B>{g}</B> was accepted.</>,
    body: 'A project workspace has been created so you can chat, share files, and track milestones together. Open it to say hi and get started.',
    cta: 'Open Project Workspace',
  },
  shortlisted: {
    emoji: '⭐',
    heading: "You've been shortlisted",
    intro: (g) => <>You made the shortlist for <B>{g}</B>.</>,
    body: 'The poster is reviewing finalists. Keep an eye on your inbox — they may reach out with questions or to confirm next steps.',
    cta: 'View Gig',
  },
  rejected: {
    emoji: '💛',
    heading: 'Update on your application',
    intro: (g) => <>Thanks for applying to <B>{g}</B>. The poster has selected a different creator this time.</>,
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
    <KretopiaEmail
      preview={`${copy.heading} — ${gigTitle}`}
      eyebrow="Application update"
      title={`${copy.heading} ${copy.emoji}`}
      actions={<Cta href={ctaUrl}>{copy.cta}</Cta>}
      note="Track all your applications anytime in your Gig Manager."
    >
      <P>{applicantName ? `Hey ${applicantName},` : 'Hey there,'} {copy.intro(gigTitle)}</P>
      <P>{copy.body}</P>
    </KretopiaEmail>
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
