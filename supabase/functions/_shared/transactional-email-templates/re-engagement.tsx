import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, Cta, K } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
  daysInactive?: number
  activeGigsCount?: number
}

const ReEngagementEmail = ({ name, activeGigsCount }: Props) => (
  <KretopiaEmail
    preview="A quick note from Ethan, founder of Kretopia"
    eyebrow="The Creative OS"
    title={name ? `${name}, here's what's new` : "Here's what's new on Kretopia"}
    actions={<Cta href={`${APP_URL}/opportunities`}>See live gigs →</Cta>}
    note={
      <>
        Your feedback shapes what we build next. Hit reply or message me directly:<br />
        <B>WhatsApp:</B> +62 811 399 6510 · <B>Email:</B> thriveinapp@gmail.com
        <br /><br />
        Thanks for being early.<br /><br />
        <span style={{ color: K.white, fontSize: '14px' }}>Ethan Auguste</span><br />
        Founder, Kretopia
      </>
    }
  >
    <P>
      I'm Ethan, founder of Kretopia. You're one of our early creators — wanted to share what's live since you last stopped by.
    </P>
    <Panel label="🔥 Live right now">
      <P style={{ margin: 0, fontSize: '14px', lineHeight: '26px' }}>
        • <B>{activeGigsCount ?? 'Several'} active gigs</B> from brands and creators<br />
        • <B>Smart Matching</B> pairs you by skill and intent<br />
        • <B>AI Verification</B> builds trust on your profile
      </P>
    </Panel>
    <P>
      These features only kick in once your profile is active. Step back inside and see who you match with this week.
    </P>
  </KretopiaEmail>
)

export const template = {
  component: ReEngagementEmail,
  subject: 'A quick note from Ethan, founder of Kretopia',
  displayName: 'Re-engagement (dormant users)',
  previewData: { name: 'Jane', daysInactive: 14, activeGigsCount: 14 },
} satisfies TemplateEntry
