import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, Cta, Small } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
}

const OnboardingReminderEmail = ({ name }: Props) => (
  <KretopiaEmail
    preview="Your creative profile is almost ready — finish setting up in 2 minutes"
    eyebrow="Almost there"
    title={name ? `${name}, you're almost there` : "You're almost there"}
    actions={
      <>
        <Cta href={`${APP_URL}/onboarding`}>Complete Your Profile</Cta>
        <Small style={{ textAlign: 'center', margin: '6px 0 0' }}>Takes less than 2 minutes — we'll walk you through it.</Small>
      </>
    }
    note={<span style={{ whiteSpace: 'pre-line' }}>{`See you on the other side,\nThe Kretopia Team`}</span>}
  >
    <P>
      You started setting up your Kretopia profile yesterday — and we saved your progress. Just a couple more steps and you'll be visible to creators, brands, and collaborators worldwide.
    </P>
    <Panel>
      <P style={{ margin: '0 0 8px' }}><B>Here's what's waiting for you:</B></P>
      <P style={{ margin: 0, fontSize: '14px', lineHeight: '25px', whiteSpace: 'pre-line' }}>
        {`🎯 Get matched with creators who complement your skills\n📍 Discover sessions, meetups and gigs near you\n🏆 Build your verified creative resume`}
      </P>
    </Panel>
  </KretopiaEmail>
)

export const template = {
  component: OnboardingReminderEmail,
  subject: "Your creative profile is 90% done — let's finish it",
  displayName: 'Onboarding reminder (24h)',
  previewData: { name: 'Marlon' },
} satisfies TemplateEntry
