import * as React from 'npm:react@18.3.1'
import { Link } from 'npm:@react-email/components@0.0.22'
import { KretopiaEmail, P, B, Small, Panel, Fact, Notice, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  attendeeName?: string
  sessionTitle?: string
  startsWhen?: string  // "Tomorrow at 8 PM EST"
  whenLabel?: 'tomorrow' | 'in_one_hour' | 'starting_soon'
  durationMin?: number
  slotMinutes?: number
  mode?: 'video' | 'audio'
  theme?: string | null
  sessionUrl?: string
  rsvpCount?: number
  isGroupMode?: boolean
}

const headlines = {
  tomorrow: '🗓 Tomorrow — your Speed Session',
  in_one_hour: '⏰ Starts in 1 hour',
  starting_soon: '🚨 Starting in 10 min',
} as const

const previews = {
  tomorrow: (t: string) => `"${t}" is on tomorrow. Add it to your calendar so you don't forget.`,
  in_one_hour: (t: string) => `"${t}" kicks off in 60 minutes. Open the lobby and warm up.`,
  starting_soon: (t: string) => `"${t}" starts in 10. Open the room and hit "I'm here".`,
}

const SpeedReminder = ({
  attendeeName,
  sessionTitle = 'Speed Session',
  startsWhen = 'Soon',
  whenLabel = 'starting_soon',
  durationMin = 60,
  slotMinutes = 5,
  mode = 'video',
  theme,
  sessionUrl = 'https://www.kretopia.com/circle/speed',
  rsvpCount,
  isGroupMode,
}: Props) => (
  <KretopiaEmail
    preview={previews[whenLabel](sessionTitle)}
    eyebrow="Speed Session"
    title={headlines[whenLabel]}
    actions={
      <>
        <Cta href={sessionUrl}>{whenLabel === 'tomorrow' ? 'Open session' : 'Open the room'}</Cta>
        <Small style={{ margin: '6px 0 0' }}>
          {whenLabel === 'tomorrow'
            ? 'Pro tip: a complete profile (avatar + role + bio) lifts your match quality. Takes 2 mins.'
            : whenLabel === 'in_one_hour'
            ? 'The lobby opens 15 min early — drop in, warm up, see who else is on.'
            : "When you land on the page, tap \"I'm here\" to enter the matching pool."}
        </Small>
      </>
    }
    note={
      <>
        Can't make it? <Link href={sessionUrl} style={{ color: K.muted, textDecoration: 'underline' }}>Cancel your RSVP</Link> so we can match someone else.
      </>
    }
  >
    <P>
      {attendeeName ? `Hey ${attendeeName} — ` : ''}<B>{sessionTitle}</B> · {startsWhen}.
    </P>

    {isGroupMode && (
      <Notice title="Heads up — tonight runs as an open group call">
        Fewer than 5 RSVPs, so instead of rotating pairs you'll meet everyone together in one room. Same time, same link.
      </Notice>
    )}

    <Panel>
      <Fact label="Format">
        {isGroupMode
          ? `Open group call · ${mode} · ${durationMin} min`
          : `${slotMinutes} min per match · ${mode} · ${durationMin} min total`}
      </Fact>
      {theme && <Fact label="Vibe">{theme}</Fact>}
      {typeof rsvpCount === 'number' && rsvpCount > 0 && (
        <Fact label="Who's coming">{rsvpCount} {rsvpCount === 1 ? 'creator' : 'creators'} so far</Fact>
      )}
    </Panel>
  </KretopiaEmail>
)

export const template = {
  component: SpeedReminder,
  subject: (data: Record<string, any>) => {
    const t = data.sessionTitle || 'your Speed Session'
    if (data.whenLabel === 'tomorrow') return `Tomorrow: ${t}`
    if (data.whenLabel === 'in_one_hour') return `Starting in 1 hour: ${t}`
    return `Starting in 10 min: ${t}`
  },
  displayName: 'Speed Session reminder',
  previewData: {
    attendeeName: 'Dee',
    sessionTitle: 'Open Creators Night',
    startsWhen: 'Tomorrow at 8 PM EST',
    whenLabel: 'tomorrow' as const,
    durationMin: 60,
    slotMinutes: 5,
    mode: 'video' as const,
    theme: 'Anyone with a creative bone',
    sessionUrl: 'https://www.kretopia.com/circle/speed/123',
    rsvpCount: 8,
    isGroupMode: false,
  },
} satisfies TemplateEntry
