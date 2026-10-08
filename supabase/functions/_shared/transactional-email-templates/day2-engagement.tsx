import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, KretoHero, P, B, Panel, Cta, Small } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
  gigCount?: number
  profileViews?: number
  role?: string
  /** Injected by send-transactional-email (one-click unsubscribe for this address). */
  unsubscribeUrl?: string
}

const Day2EngagementEmail = ({ name, gigCount = 0, profileViews = 0, role, unsubscribeUrl }: Props) => (
  <KretopiaEmail
    preview={
      gigCount > 0
        ? `${gigCount} new opportunities match your profile`
        : `Your profile is gaining traction on Kretopia`
    }
    eyebrow="Your first days"
    title={name ? `${name}, here's what's happening` : "Here's what's happening"}
    hero={<KretoHero />}
    unsubscribeUrl={unsubscribeUrl}
    actions={
      <>
        <Cta href={`${APP_URL}/?utm_source=lifecycle&utm_campaign=day2`}>{gigCount > 0 ? 'See matching gigs' : 'Open Kretopia'}</Cta>
        <Small style={{ textAlign: 'center', margin: '6px 0 0' }}>
          One unread message can turn into a paid project. Don't keep collaborators waiting.
        </Small>
      </>
    }
    note="The Kretopia Team"
  >
    <P>You joined Kretopia a couple of days ago. Here's the snapshot of your network so far.</P>
    <Panel>
      {profileViews > 0 && (
        <P style={{ margin: '0 0 8px', fontSize: '14px' }}>
          <B>{profileViews}</B> {profileViews === 1 ? 'person has' : 'people have'} viewed your profile
        </P>
      )}
      {gigCount > 0 && (
        <P style={{ margin: '0 0 8px', fontSize: '14px' }}>
          <B>{gigCount}</B> active gig{gigCount === 1 ? '' : 's'} match{gigCount === 1 ? 'es' : ''} {role ? `your "${role}" role` : 'your profile'}
        </P>
      )}
      {!profileViews && !gigCount && (
        <P style={{ margin: 0, fontSize: '14px' }}>
          Your verified credits are live and indexed. Boost discovery by sharing your profile link or applying to a gig.
        </P>
      )}
    </Panel>
  </KretopiaEmail>
)

export const template = {
  component: Day2EngagementEmail,
  subject: (data: Record<string, any>) =>
    data.gigCount > 0
      ? `${data.gigCount} gig${data.gigCount === 1 ? '' : 's'} match your profile`
      : `Your week on Kretopia`,
  displayName: 'Day-2 engagement nudge',
  previewData: { name: 'Marlon', gigCount: 3, profileViews: 12, role: 'Photographer' },
} satisfies TemplateEntry
