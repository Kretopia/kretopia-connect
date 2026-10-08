/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, Cta } from '../email-kit.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <KretopiaEmail
    preview="Your Kretopia sign-in link"
    eyebrow="The Creative OS"
    title="Your sign-in link"
    actions={<Cta href={confirmationUrl}>Sign in</Cta>}
    note="Didn't request this? You can safely ignore this email."
  >
    <P>Tap below to sign in to Kretopia. This link expires shortly, so don't wait too long.</P>
  </KretopiaEmail>
)

export default MagicLinkEmail
