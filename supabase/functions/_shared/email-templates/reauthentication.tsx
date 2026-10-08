/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, Code } from '../email-kit.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <KretopiaEmail
    preview="Your Kretopia verification code"
    eyebrow="The Creative OS"
    title="Verification code"
    note="This code expires shortly. If you didn't request this, you can ignore it."
  >
    <P>Use this code to confirm your identity:</P>
    <Code>{token}</Code>
  </KretopiaEmail>
)

export default ReauthenticationEmail
