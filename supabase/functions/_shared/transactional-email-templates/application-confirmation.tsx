import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  applicantName?: string
  gigTitle?: string
  gigUrl?: string
}

const ApplicationConfirmationEmail = ({ applicantName, gigTitle, gigUrl }: Props) => (
  <KretopiaEmail
    preview={`Your application for "${gigTitle || 'a gig'}" has been submitted`}
    eyebrow="Application"
    title="Application Submitted! 🎉"
    actions={gigUrl ? <Cta href={gigUrl}>View Gig Details</Cta> : undefined}
    note="Keep building your portfolio — verified credits and reviews help you stand out. ✨"
  >
    <P>
      {applicantName ? `Hey ${applicantName},` : 'Hey there,'} your application for <B>{gigTitle || 'this gig'}</B> has been successfully submitted.
    </P>
    <P>
      The creator will review your application and get back to you. You can track the status of all your applications in your Gig Manager.
    </P>
  </KretopiaEmail>
)

export const template = {
  component: ApplicationConfirmationEmail,
  subject: (data: Record<string, any>) => `Application submitted: ${data.gigTitle || 'New Gig'}`,
  displayName: 'Application confirmation',
  previewData: { applicantName: 'Dee', gigTitle: 'AI Image Creator for Fashion E-commerce', gigUrl: 'https://www.kretopia.com/opportunity/123' },
} satisfies TemplateEntry
