import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://www.kretopia.com'
// Opaque-black lockup from the public asset store: the page background below is pure black on purpose.
const LOGO_URL = `${SITE_URL}/__l5e/assets-v1/6656504f-e518-4dcb-974e-ebe4d8a8a05e/kretopia-lockup.png`

interface CreditChainInviteProps {
  recipientName?: string
  inviterName?: string
  projectName?: string
  role?: string
  /** One-tap confirmation page (no account needed). */
  confirmUrl?: string
  /** Older callers only send this; it is the same link. */
  claimUrl?: string
}

const CreditChainInviteEmail = ({
  recipientName,
  inviterName = 'A collaborator',
  projectName = 'a project',
  role = 'Collaborator',
  confirmUrl,
  claimUrl,
}: CreditChainInviteProps) => {
  const link = confirmUrl || claimUrl || SITE_URL
  const firstName = recipientName ? recipientName.trim().split(/\s+/)[0] : undefined

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${inviterName} says you worked together on ${projectName}. Confirm it in 5 seconds.`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={topBar} />
          <Section style={logoRow}>
            <Img src={LOGO_URL} width="150" alt="Kretopia" style={{ margin: '0 auto' }} />
          </Section>

          <Section style={hero}>
            <Text style={eyebrow}>Confirm a credit</Text>
            <Heading style={h1}>{firstName ? `${firstName}, did` : 'Did'} you work on {projectName}?</Heading>
            <Text style={lead}>
              <strong style={{ color: '#ffffff' }}>{inviterName}</strong> says you worked together, and added it to their
              Kretopia record, the verified record of creative work. One tap from you makes the credit count.
            </Text>
          </Section>

          <Section style={card}>
            <Text style={cardEyebrow}>The credit</Text>
            <Text style={cardTitle}>{projectName}</Text>
            <Text style={cardMeta}>
              {inviterName}'s role: <strong style={{ color: '#f2f1f7' }}>{role}</strong>
            </Text>
          </Section>

          <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
            <Button href={link} style={primaryButton}>
              Yes, we worked together →
            </Button>
            <Text style={microcopy}>Takes 5 seconds. No account needed.</Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Not you, or not sure? You can say so on the same page. Nothing is published without your answer.
          </Text>
          <Text style={footerLink}>
            Or open this link: <a href={link} style={linkStyle}>{link}</a>
          </Text>
          <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · Where Creativity Lives · kretopia.com</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CreditChainInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.inviterName
      ? `${data.inviterName} says you worked on ${data?.projectName ?? 'a project'}. Confirm it`
      : `Confirm your credit on ${data?.projectName ?? 'a Kretopia project'}`,
  displayName: 'Credit Chain Invite',
  previewData: {
    recipientName: 'Jordan Pierce',
    inviterName: 'Maya Chen',
    projectName: 'Midnight Sessions EP',
    role: 'Mixing Engineer',
    confirmUrl: 'https://www.kretopia.com/credit-verify?token=sample',
  },
} satisfies TemplateEntry

const PURPLE = '#7b2bf9'
const PINK = '#ee2073'
const BG = '#000000'
const CARD = '#111217'
const LINE = '#26252b'

const main = { backgroundColor: BG, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", margin: '0', padding: '0' }
const container = { maxWidth: '520px', margin: '0 auto', backgroundColor: BG, padding: '0 20px 32px' }
const topBar = { height: '4px', background: `linear-gradient(90deg, #5b2cf0 0%, ${PINK} 60%, #ff5521 100%)`, margin: '0 -20px 8px', fontSize: '0', lineHeight: '4px' }
const logoRow = { textAlign: 'center' as const, padding: '24px 0 4px' }
const hero = { textAlign: 'center' as const, padding: '16px 0 20px' }
const eyebrow = { fontSize: '11px', fontWeight: '700' as const, letterSpacing: '2px', textTransform: 'uppercase' as const, color: PINK, margin: '0 0 10px' }
const h1 = { fontSize: '28px', lineHeight: '36px', fontWeight: '800' as const, color: '#ffffff', margin: '0 0 14px' }
const lead = { fontSize: '15px', lineHeight: '24px', color: '#a9a8b6', margin: '0 auto', maxWidth: '430px' }
const card = { backgroundColor: CARD, border: `1px solid ${LINE}`, borderTop: `2px solid ${PURPLE}`, borderRadius: '12px', padding: '18px 22px', margin: '0 0 20px' }
const cardEyebrow = { fontSize: '10px', fontWeight: '700' as const, letterSpacing: '1.8px', textTransform: 'uppercase' as const, color: '#7c7e8d', margin: '0 0 6px' }
const cardTitle = { fontSize: '18px', fontWeight: '700' as const, color: '#ffffff', margin: '0 0 4px' }
const cardMeta = { fontSize: '13px', color: '#8a8893', margin: '0' }
const primaryButton = {
  backgroundColor: PURPLE,
  backgroundImage: `linear-gradient(90deg, ${PURPLE} 0%, ${PINK} 100%)`,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700' as const,
  borderRadius: '12px',
  padding: '15px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const microcopy = { fontSize: '12px', color: '#6d6c78', margin: '12px 0 0' }
const hr = { borderColor: LINE, margin: '24px 0 16px' }
const footer = { fontSize: '12px', lineHeight: '19px', color: '#8a8893', margin: '0 0 10px', textAlign: 'center' as const }
const footerLink = { fontSize: '11px', color: '#55545f', margin: '0 0 10px', textAlign: 'center' as const, wordBreak: 'break-all' as const }
const linkStyle = { color: '#c8a6ff' }
const footerBrand = { fontSize: '11px', color: '#55545f', margin: '0', textAlign: 'center' as const }
