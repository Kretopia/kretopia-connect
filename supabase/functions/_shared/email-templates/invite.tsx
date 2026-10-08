/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, A, B, Cta } from '../email-kit.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <KretopiaEmail
    preview="You've been invited to Kretopia"
    eyebrow="The Creative OS"
    title="You're invited"
    actions={<Cta href={confirmationUrl}>Accept invitation</Cta>}
    note="Wasn't expecting this? Just ignore this email."
  >
    <P>
      Someone on <A href={siteUrl}><B>Kretopia</B></A> thinks you'd be a great addition to the professional creative network. Accept to claim your credits, set up your profile, and start getting booked.
    </P>
  </KretopiaEmail>
)

export default InviteEmail
