import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Small, Panel, Person, Cta } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface PersonCard {
  name: string
  role?: string | null
  avatar?: string | null
  profileUrl?: string | null
}

interface Props {
  attendeeName?: string
  sessionTitle?: string
  totalMet?: number
  connected?: PersonCard[]
  savedYou?: PersonCard[]
  met?: PersonCard[]
  browseUrl?: string
}

const SpeedRecapEmail = ({
  attendeeName,
  sessionTitle = 'Last night\'s Speed Session',
  totalMet = 0,
  connected = [],
  savedYou = [],
  met = [],
  browseUrl = 'https://www.kretopia.com/circle/speed',
}: Props) => (
  <KretopiaEmail
    preview={`You met ${totalMet} ${totalMet === 1 ? 'creator' : 'creators'} last night — here's your recap.`}
    eyebrow="Speed Session recap"
    title={attendeeName ? `Morning, ${attendeeName} 👋` : 'Morning 👋'}
    actions={<Cta href={browseUrl}>See next week's session</Cta>}
    note="Speed Sessions run weekly. Bring a friend — the more creators in the room, the better the matches."
  >
    <P>
      Last night at <B>{sessionTitle}</B> you met <B>{totalMet}</B> {totalMet === 1 ? 'creator' : 'creators'}. Here's where to pick up.
    </P>

    {connected.length > 0 && (
      <Panel label="🤝 You connected with">
        {connected.map((p, i) => <Person key={`c-${i}`} name={p.name} role={p.role} avatar={p.avatar} />)}
      </Panel>
    )}

    {savedYou.length > 0 && (
      <Panel label="⭐ Saved you for later">
        <Small>These creators tapped "save" on you. Worth a hello.</Small>
        {savedYou.map((p, i) => <Person key={`s-${i}`} name={p.name} role={p.role} avatar={p.avatar} />)}
      </Panel>
    )}

    {met.length > 0 && connected.length === 0 && savedYou.length === 0 && (
      <Panel label="👀 You met">
        <Small>Want to keep one of these going? Open their profile and send a quick note.</Small>
        {met.slice(0, 6).map((p, i) => <Person key={`m-${i}`} name={p.name} role={p.role} avatar={p.avatar} />)}
      </Panel>
    )}
  </KretopiaEmail>
)

export const template = {
  component: SpeedRecapEmail,
  subject: (data: Record<string, any>) =>
    `Your recap from ${data.sessionTitle || 'last night\'s Speed Session'}`,
  displayName: 'Speed Session recap',
  previewData: {
    attendeeName: 'Dee',
    sessionTitle: 'Open Creators Night',
    totalMet: 5,
    connected: [{ name: 'Maya Chen', role: 'Director' }],
    savedYou: [{ name: 'Jordan Ali', role: 'Music Producer' }],
    met: [
      { name: 'Maya Chen', role: 'Director' },
      { name: 'Jordan Ali', role: 'Music Producer' },
      { name: 'Sasha P.', role: 'Photographer' },
    ],
    browseUrl: 'https://www.kretopia.com/circle/speed',
  },
} satisfies TemplateEntry
