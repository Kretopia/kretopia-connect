import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  ownerName?: string
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
}

const NewApplicantNotificationEmail = ({ ownerName, applicantName, gigTitle, gigUrl }: Props) => (
  <KretopiaEmail
    preview={`New application for "${gigTitle || 'your gig'}"`}
    eyebrow="New applicant"
    title="New Application Received 📩"
    actions={gigUrl ? <Cta href={gigUrl}>Review Application</Cta> : undefined}
    note="Manage all your gigs and applicants from your Gig Manager anytime."
  >
    <P>
      {ownerName ? `Hey ${ownerName},` : 'Hey there,'} <B>{applicantName || 'Someone'}</B> has applied to your gig: <B>{gigTitle || 'your listing'}</B>.
    </P>
    <P>Head over to your Gig Manager to review their application, cover letter, and portfolio.</P>
  </KretopiaEmail>
)

export const template = {
  component: NewApplicantNotificationEmail,
  subject: (data: Record<string, any>) => `New application: ${data.gigTitle || 'Your Gig'}`,
  displayName: 'New applicant notification',
  previewData: { ownerName: 'Ethan', applicantName: 'Dee McRae', gigTitle: 'AI Image Creator for Fashion E-commerce', gigUrl: 'https://www.kretopia.com/opportunity/123' },
} satisfies TemplateEntry
