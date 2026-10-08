/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, A, Cta } from '../email-kit.tsx'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <KretopiaEmail
    preview="Confirm your new email for Kretopia"
    eyebrow="The Creative OS"
    title="Confirm your new email"
    actions={<Cta href={confirmationUrl}>Confirm email change</Cta>}
    note="Didn't request this? Please secure your account immediately."
  >
    <P>
      You requested to change your Kretopia email from{' '}
      <A href={`mailto:${email}`}>{email}</A>
      {' '}to{' '}
      <A href={`mailto:${newEmail}`}>{newEmail}</A>. Tap below to confirm.
    </P>
  </KretopiaEmail>
)

export default EmailChangeEmail
