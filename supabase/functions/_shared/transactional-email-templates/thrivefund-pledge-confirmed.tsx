import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, Fact, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  backerName?: string
  campaignTitle?: string
  pledgeAmount?: string
  campaignUrl?: string
  deadlineDate?: string
}

const PledgeConfirmedEmail = ({
  backerName, campaignTitle, pledgeAmount, campaignUrl, deadlineDate,
}: Props) => (
  <KretopiaEmail
    preview={`Your pledge to ${campaignTitle || 'a ThriveFund campaign'} is in`}
    eyebrow="ThriveFund"
    title="🚀 Pledge confirmed"
    actions={campaignUrl ? <Cta href={campaignUrl}>View campaign</Cta> : undefined}
    note="You're helping a verified creator bring real work to life. 💜"
  >
    <P>
      {backerName ? `Hey ${backerName},` : 'Hey,'} thanks for backing <B>{campaignTitle}</B>!
    </P>
    <Panel>
      <Fact label="Your pledge" strong>{pledgeAmount || '—'}</Fact>
      <Fact label="How it works">
        <span style={{ fontWeight: 400, fontSize: '14px', lineHeight: '21px' }}>
          Your card was authorized — but you'll only be charged if the campaign hits its goal by {deadlineDate || 'the deadline'}.
          If it doesn't reach the goal, the authorization is released and nothing is charged.
        </span>
      </Fact>
    </Panel>
  </KretopiaEmail>
)

export const template = {
  component: PledgeConfirmedEmail,
  subject: (d: Record<string, any>) => `Pledge confirmed: ${d.campaignTitle || 'ThriveFund'}`,
  displayName: 'ThriveFund — Pledge confirmed',
  previewData: {
    backerName: 'Dee',
    campaignTitle: 'Short Film: Brooklyn Tides',
    pledgeAmount: '$50.00',
    campaignUrl: 'https://www.kretopia.com/fund/brooklyn-tides',
    deadlineDate: 'May 15, 2026',
  },
} satisfies TemplateEntry
