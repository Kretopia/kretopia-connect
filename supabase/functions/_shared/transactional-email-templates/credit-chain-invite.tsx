import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface CreditChainInviteProps {
  recipientName?: string
  inviterName?: string
  projectName?: string
  role?: string
  claimUrl?: string
}

const CreditChainInviteEmail = ({
  recipientName = 'there',
  inviterName = 'A collaborator',
  projectName = 'a project',
  role = 'Collaborator',
  claimUrl = 'https://www.kretopia.com',
}: CreditChainInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${inviterName} credited you on ${projectName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Kretopia</Heading>
          <Text style={eyebrow}>YOU WERE CREDITED</Text>
        </Section>

        <Heading style={h1}>Hey {recipientName},</Heading>
        <Text style={bodyText}>
          {inviterName} credited you as <strong>{role}</strong> on{' '}
          <strong>"{projectName}"</strong> on Kretopia — a professional home for
          creators to build a verified Creative Passport.
        </Text>
        <Text style={bodyText}>
          Claim this credit to add it to your own record, and co-sign it back
          to confirm it happened.
        </Text>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={claimUrl} style={button}>Claim your credit</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Or open this link: <a href={claimUrl} style={link}>{claimUrl}</a>
        </Text>
        <Text style={footerBrand}>© {new Date().getFullYear()} Kretopia · kretopia.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CreditChainInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.inviterName
      ? `${data.inviterName} credited you on ${data?.projectName ?? 'a project'}`
      : `You were credited on ${data?.projectName ?? 'a Kretopia project'}`,
  displayName: 'Credit Chain Invite',
  previewData: {
    recipientName: 'Jordan',
    inviterName: 'Maya from Kretopia',
    projectName: 'Midnight Sessions EP',
    role: 'Mixing Engineer',
    claimUrl: 'https://www.kretopia.com/auth?claim=sample',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const header = { marginBottom: '20px' }
const brand = { fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }
const eyebrow = { fontSize: '11px', fontWeight: 700, color: '#7B61FF', margin: 0, letterSpacing: '0.15em' }
const h1 = { fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 12px', lineHeight: 1.2 }
const bodyText = { fontSize: '15px', color: '#334155', margin: '0 0 14px', lineHeight: 1.6 }
const button = { backgroundColor: '#C6FF00', color: '#0F172A', padding: '14px 32px', borderRadius: '10px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#64748B', margin: 0 }
const link = { color: '#7B61FF', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#bbbbbb', margin: '12px 0 0' }
