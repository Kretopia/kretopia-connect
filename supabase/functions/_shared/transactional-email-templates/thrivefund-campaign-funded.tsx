import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, Fact, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  campaignTitle?: string
  totalRaised?: string
  backerCount?: number
  isCreator?: boolean
  campaignUrl?: string
}

const CampaignFundedEmail = ({
  recipientName, campaignTitle, totalRaised, backerCount, isCreator, campaignUrl,
}: Props) => (
  <KretopiaEmail
    preview={`${campaignTitle || 'A ThriveFund campaign'} is fully funded! 🎉`}
    eyebrow="ThriveFund"
    title="🎉 It's funded!"
    actions={campaignUrl ? <Cta href={campaignUrl}>View campaign</Cta> : undefined}
    note="This is what verified crowdfunding looks like. 💜"
  >
    <P>
      {recipientName ? `Hey ${recipientName},` : 'Hey,'} <B>{campaignTitle}</B> hit its goal.
    </P>
    <Panel>
      <Fact label="Total raised" strong>{totalRaised || '—'}</Fact>
      <Fact label="Backers">{backerCount ?? 0}</Fact>
    </Panel>
    <P>
      {isCreator
        ? 'The first milestone tranche has been released to your connected payout account. The rest unlocks as you mark milestones complete.'
        : 'Your card has been charged for the pledged amount. The creator now has the funds to bring this work to life — they\'ll keep you posted with updates.'}
    </P>
  </KretopiaEmail>
)

export const template = {
  component: CampaignFundedEmail,
  subject: (d: Record<string, any>) => `🎉 Funded: ${d.campaignTitle || 'ThriveFund campaign'}`,
  displayName: 'ThriveFund — Campaign funded',
  previewData: {
    recipientName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    totalRaised: '$12,450',
    backerCount: 187,
    isCreator: false,
    campaignUrl: 'https://www.kretopia.com/fund/brooklyn-tides',
  },
} satisfies TemplateEntry
