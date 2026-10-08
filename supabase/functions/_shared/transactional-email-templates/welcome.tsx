import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, Panel, Cta, B, K } from '../email-kit.tsx'
import { Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const APP_URL = 'https://www.kretopia.com'
const SETTINGS_URL = 'https://www.kretopia.com/settings'

interface Props {
  name?: string
  /** Injected by send-transactional-email (one-click unsubscribe for this address). */
  unsubscribeUrl?: string
}

const TIPS: Array<{ title: string; body: string }> = [
  {
    title: 'Set up your Passport',
    body: 'Add your role, credits and links so collaborators can see your work in one place.',
  },
  {
    title: 'Start from Today',
    body: 'Today shows your next step. Open a Studio to keep a project’s brief, files, tasks and conversation together.',
  },
  {
    title: 'Look for opportunities in Scout',
    body: 'Scout surfaces opportunities that fit your profile. Always check the source before you apply.',
  },
  {
    title: 'Ask Kreto',
    body: 'Kreto helps you draft pitches, organise a brief and plan follow-ups.',
  },
]

const WelcomeEmail = ({ name, unsubscribeUrl }: Props) => (
  <KretopiaEmail
    preview={`Welcome to ${SITE_NAME} — four ways to get started`}
    eyebrow="Welcome"
    title={name ? `Welcome, ${name}` : 'Welcome to Kretopia'}
    actions={<Cta href={APP_URL}>Open Today</Cta>}
    note={
      <>
        — The Kretopia team
        <br /><br />
        You’re receiving this because you created a Kretopia account.{' '}
        <Link href={unsubscribeUrl || SETTINGS_URL} style={{ color: K.dim, textDecoration: 'underline' }}>
          {unsubscribeUrl ? 'Unsubscribe' : 'Manage email preferences'}
        </Link>
      </>
    }
  >
    <P>Your account is ready. Here are four ways to get started.</P>
    <Panel>
      {TIPS.map((tip, i) => (
        <div key={tip.title} style={{ padding: '10px 0', borderBottom: i === TIPS.length - 1 ? 'none' : `1px solid ${K.line}` }}>
          <div style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: K.white }}>{i + 1}. {tip.title}</div>
          <div style={{ fontSize: '13px', lineHeight: '20px', color: K.muted }}>{tip.body}</div>
        </div>
      ))}
    </Panel>
  </KretopiaEmail>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Kretopia',
  displayName: 'Welcome',
  previewData: { name: 'Jane', unsubscribeUrl: 'https://www.kretopia.com/unsubscribe?token=preview' },
} satisfies TemplateEntry
