import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kretopia'
const LOGO_URL = 'https://www.kretopia.com/apple-touch-icon.png'
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
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${total} new item${total === 1 ? '' : 's'} ready to review on your profile`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="48" height="48" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
          <Heading style={h1}>
            {name ? `${name}, we found new things about you` : "We found new things about you"}
          </Heading>
          <Text style={text}>
            Our weekly scan picked up {total} new item{total === 1 ? '' : 's'} across the web that look like they belong on your profile.
          </Text>
          <Section style={statsBox}>
            {newCredits > 0 && (
              <Text style={statLine}><strong style={{ color: '#7B61FF' }}>{newCredits}</strong> new credit{newCredits === 1 ? '' : 's'}</Text>
            )}
            {newPress > 0 && (
              <Text style={statLine}><strong style={{ color: '#7B61FF' }}>{newPress}</strong> press mention{newPress === 1 ? '' : 's'}</Text>
            )}
            {newAwards > 0 && (
              <Text style={statLine}><strong style={{ color: '#7B61FF' }}>{newAwards}</strong> award{newAwards === 1 ? '' : 's'}</Text>
            )}
            {newUploads > 0 && (
              <Text style={statLine}><strong style={{ color: '#7B61FF' }}>{newUploads}</strong> new upload{newUploads === 1 ? '' : 's'}</Text>
            )}
          </Section>
          <Button style={button} href={url}>Review findings</Button>
          <Text style={subtext}>
            Accept what's yours, dismiss what isn't. Takes about a minute.
          </Text>
          <Text style={footer}>The {SITE_NAME} Team</Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>

        </Container>
      </Body>
    </Html>
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

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#606068', lineHeight: '1.6', margin: '0 0 24px' }
const statsBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  borderLeft: '4px solid #7B61FF',
}
const statLine = { fontSize: '14px', color: '#3a3a44', lineHeight: '1.6', margin: '0 0 8px' }
const button = {
  backgroundColor: '#7B61FF',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'block' as const,
  textAlign: 'center' as const,
}
const subtext = { fontSize: '13px', color: '#999999', margin: '12px 0 32px', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', whiteSpace: 'pre-line' as const }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
