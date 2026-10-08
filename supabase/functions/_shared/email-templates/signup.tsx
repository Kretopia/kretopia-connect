/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, A, Cta } from '../email-kit.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <KretopiaEmail
    preview="Verify your email to get started on Kretopia"
    eyebrow="The Creative OS"
    title="Welcome to Kretopia"
    actions={<Cta href={confirmationUrl}>Verify & get started</Cta>}
    note="If you didn't sign up for Kretopia, you can safely ignore this email."
  >
    <P>
      You're one step away from joining the professional creative network. Verify your email to claim verified credits, apply to real gigs, and unlock your dashboard.
    </P>
    <P>
      Confirm <A href={`mailto:${recipient}`}>{recipient}</A>:
    </P>
  </KretopiaEmail>
)

export default SignupEmail
