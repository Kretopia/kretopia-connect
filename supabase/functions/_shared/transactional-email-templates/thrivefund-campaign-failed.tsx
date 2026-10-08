import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  campaignTitle?: string
  isCreator?: boolean
  exploreUrl?: string
}

const CampaignFailedEmail = ({ recipientName, campaignTitle, isCreator, exploreUrl }: Props) => (
  <KretopiaEmail
    preview={`Update on ${campaignTitle || 'your ThriveFund campaign'}`}
    eyebrow="ThriveFund"
    title={isCreator ? 'Campaign closed' : 'Update on your pledge'}
    actions={exploreUrl ? <Cta href={exploreUrl}>{isCreator ? 'Plan your relaunch' : 'Explore other campaigns'}</Cta> : undefined}
    note="Thanks for being part of ThriveFund."
  >
    <P>
      {recipientName ? `Hey ${recipientName},` : 'Hey,'} <B>{campaignTitle}</B> didn't reach its funding goal by the deadline.
    </P>
    <P>
      {isCreator
        ? 'Because ThriveFund is all-or-nothing, no backers were charged. You can refine the pitch, lower the goal, or relaunch when ready — your verified profile and supporters are still here.'
        : 'Because ThriveFund is all-or-nothing, your card was not charged. The authorization will be released by your bank within a few business days.'}
    </P>
  </KretopiaEmail>
)

export const template = {
  component: CampaignFailedEmail,
  subject: (d: Record<string, any>) =>
    d.isCreator
      ? `Update: ${d.campaignTitle || 'your campaign'} closed without funding`
      : `Update: ${d.campaignTitle || 'a campaign you backed'} didn't fund`,
  displayName: 'ThriveFund — Campaign did not fund',
  previewData: {
    recipientName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    isCreator: false,
    exploreUrl: 'https://www.kretopia.com/fund',
  },
} satisfies TemplateEntry
