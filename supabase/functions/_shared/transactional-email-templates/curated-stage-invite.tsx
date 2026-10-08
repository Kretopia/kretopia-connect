import * as React from 'npm:react@18.3.1'
import { Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, Panel, Quote, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface CuratedStageInviteProps {
  hostName?: string
  stageTitle?: string
  startsAt?: string
  joinUrl?: string
  personalNote?: string
}

const formatWhen = (iso?: string) => {
  if (!iso) return undefined
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return undefined
  }
}

const CuratedStageInviteEmail = ({
  hostName = 'A host on Kretopia',
  stageTitle = 'a Kretopia Stage',
  startsAt,
  joinUrl = 'https://www.kretopia.com',
  personalNote,
}: CuratedStageInviteProps) => (
  <KretopiaEmail
    preview={`${hostName} invited you to ${stageTitle}`}
    eyebrow="Stage invite"
    title={stageTitle}
    subtitle={`Hosted by ${hostName}`}
    actions={<Cta href={joinUrl}>Join the Stage</Cta>}
    note={
      <>
        Or open this link: <Link href={joinUrl} style={{ color: K.muted, wordBreak: 'break-all' }}>{joinUrl}</Link>
      </>
    }
  >
    {formatWhen(startsAt) && (
      <Panel>
        <div style={{ margin: '4px 0', fontSize: '14px', fontWeight: 500, color: K.white }}>📅 {formatWhen(startsAt)}</div>
      </Panel>
    )}
    {personalNote && <Quote>"{personalNote}"</Quote>}
  </KretopiaEmail>
)

export const template = {
  component: CuratedStageInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.hostName
      ? `${data.hostName} invited you to ${data?.stageTitle ?? 'a Stage'}`
      : `You're invited: ${data?.stageTitle ?? 'a Kretopia Stage'}`,
  displayName: 'Curated Stage Invite',
  previewData: {
    hostName: 'Maya from Kretopia',
    stageTitle: 'Late Night Listening Session',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    joinUrl: 'https://www.kretopia.com/circle/stage/sample',
    personalNote: 'Would love to have you in the room.',
  },
} satisfies TemplateEntry
