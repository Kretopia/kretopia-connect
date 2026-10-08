import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, SITE_URL, P, B, Panel, Small, Cta, K } from '../email-kit.tsx'
import { Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface CreditChainInviteProps {
  recipientName?: string
  inviterName?: string
  projectName?: string
  role?: string
  /** One-tap confirmation page (no account needed). */
  confirmUrl?: string
  /** Older callers only send this; it is the same link. */
  claimUrl?: string
}

const CreditChainInviteEmail = ({
  recipientName,
  inviterName = 'A collaborator',
  projectName = 'a project',
  role = 'Collaborator',
  confirmUrl,
  claimUrl,
}: CreditChainInviteProps) => {
  const link = confirmUrl || claimUrl || SITE_URL
  const firstName = recipientName ? recipientName.trim().split(/\s+/)[0] : undefined

  return (
    <KretopiaEmail
      preview={`${inviterName} says you worked together on ${projectName}. Confirm it in 5 seconds.`}
      eyebrow="Confirm a credit"
      title={`${firstName ? `${firstName}, did` : 'Did'} you work on ${projectName}?`}
      actions={
        <>
          <Cta href={link}>Yes, we worked together →</Cta>
          <Small style={{ textAlign: 'center', margin: '6px 0 0' }}>Takes 5 seconds. No account needed.</Small>
        </>
      }
      note={
        <>
          Not you, or not sure? You can say so on the same page. Nothing is published without your answer.
          <br /><br />
          Or open this link: <Link href={link} style={{ color: K.muted, wordBreak: 'break-all' }}>{link}</Link>
        </>
      }
    >
      <P>
        <B>{inviterName}</B> says you worked together, and added it to their Kretopia record, the verified record of creative work. One tap from you makes the credit count.
      </P>
      <Panel label="The credit">
        <div style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: K.white }}>{projectName}</div>
        <div style={{ fontSize: '13px', color: K.muted }}>{inviterName}'s role: <B>{role}</B></div>
      </Panel>
    </KretopiaEmail>
  )
}

export const template = {
  component: CreditChainInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.inviterName
      ? `${data.inviterName} says you worked on ${data?.projectName ?? 'a project'}. Confirm it`
      : `Confirm your credit on ${data?.projectName ?? 'a Kretopia project'}`,
  displayName: 'Credit Chain Invite',
  previewData: {
    recipientName: 'Jordan Pierce',
    inviterName: 'Maya Chen',
    projectName: 'Midnight Sessions EP',
    role: 'Mixing Engineer',
    confirmUrl: 'https://www.kretopia.com/credit-verify?token=sample',
  },
} satisfies TemplateEntry
