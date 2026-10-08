/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, Cta } from '../email-kit.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <KretopiaEmail
    preview="Reset your Kretopia password"
    eyebrow="The Creative OS"
    title="Reset your password"
    actions={<Cta href={confirmationUrl}>Reset password</Cta>}
    note="Didn't request this? Your password stays the same — just ignore this email."
  >
    <P>We got a request to reset your Kretopia password. Tap below to choose a new one — takes 30 seconds.</P>
  </KretopiaEmail>
)

export default RecoveryEmail
