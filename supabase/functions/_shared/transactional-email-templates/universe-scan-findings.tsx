import * as React from 'npm:react@18.3.1'
import { KretopiaEmail, P, B, Panel, Cta, Small } from '../email-kit.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const APP_URL = 'https://www.kretopia.com'

interface Props {
  name?: string
  newCredits?: number
  newPress?: number
  newAwards?: number
  newUploads?: number
  reviewUrl?: string
}

const UniverseScanFindingsEmail = ({
  name,
  newCredits = 0,
  newPress = 0,
  newAwards = 0,
  newUploads = 0,
  reviewUrl,
}: Props) => {
  const total = newCredits + newPress + newAwards + newUploads
  const url = reviewUrl || `${APP_URL}/?openPendingDiscoveries=1`
  const line = { margin: '0 0 8px', fontSize: '14px' }
  return (
    <KretopiaEmail
      preview={`${total} new item${total === 1 ? '' : 's'} ready to review on your profile`}
      eyebrow="Weekly scan"
      title={name ? `${name}, we found new things about you` : 'We found new things about you'}
      actions={
        <>
          <Cta href={url}>Review findings</Cta>
          <Small style={{ textAlign: 'center', margin: '6px 0 0' }}>Accept what's yours, dismiss what isn't. Takes about a minute.</Small>
        </>
      }
      note={`The ${SITE_NAME} Team`}
    >
      <P>
        Our weekly scan picked up {total} new item{total === 1 ? '' : 's'} across the web that look like they belong on your profile.
      </P>
      <Panel>
        {newCredits > 0 && <P style={line}><B>{newCredits}</B> new credit{newCredits === 1 ? '' : 's'}</P>}
        {newPress > 0 && <P style={line}><B>{newPress}</B> press mention{newPress === 1 ? '' : 's'}</P>}
        {newAwards > 0 && <P style={line}><B>{newAwards}</B> award{newAwards === 1 ? '' : 's'}</P>}
        {newUploads > 0 && <P style={line}><B>{newUploads}</B> new upload{newUploads === 1 ? '' : 's'}</P>}
      </Panel>
    </KretopiaEmail>
  )
}

export const template = {
  component: UniverseScanFindingsEmail,
  subject: (data: Record<string, any>) => {
    const total = (data.newCredits || 0) + (data.newPress || 0) + (data.newAwards || 0) + (data.newUploads || 0)
    return `${total} new item${total === 1 ? '' : 's'} ready to review on Kretopia`
  },
  displayName: 'Universe scan findings',
  previewData: { name: 'Marlon', newCredits: 2, newPress: 1, newAwards: 0, newUploads: 3 },
} satisfies TemplateEntry
