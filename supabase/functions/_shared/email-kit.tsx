/// <reference types="npm:@types/react@18.3.1" />
// Kretopia email kit: ONE holo-card shell + a handful of blocks, used by every transactional and auth
// email, so the brand lives in a single place. Mirrors the in-app pass (EventPassCard / HoloCard):
// brand-gradient hairline frame, violet halo, ticket perforation with notches, white canonical CTA.
//
// Email-client rules this file follows: inline styles only (no CSS variables), tables for layout where
// it matters, and every gradient/radius is decoration with a flat fallback, so Outlook (which ignores
// both) still shows a clean dark card. Tokens are copied from src/index.css (.dark).
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

export const SITE_URL = 'https://www.kretopia.com'
const ASSETS = `${SITE_URL}/__l5e/assets-v1`
const K_MARK_URL = `${ASSETS}/0b662b7c-ffb2-4428-a722-862dbee073a6/kretopia-k-mark.png`
const WORDMARK_URL = `${ASSETS}/c4aac835-5e35-479e-af14-5972b95a11f1/kretopia-wordmark.png`
export const KRETO_WAVE_URL = `${SITE_URL}/email/kreto-wave.png`

// ── Pass QR (rendered by the event-pass-qr edge function; emails can't run the app's QR library) ──
const FUNCTIONS_BASE = (() => {
  try {
    // @ts-ignore Deno global (edge runtime only); SUPABASE_URL exists there, the fallback is production
    return (typeof Deno !== 'undefined' && Deno.env.get('SUPABASE_URL')) || 'https://kwmcocsitwssrtzkdojh.supabase.co'
  } catch {
    return 'https://kwmcocsitwssrtzkdojh.supabase.co'
  }
})()
/** Real check-in tokens are 32 hex chars; anything else gets no QR rather than a broken image. */
export const passQrUrl = (token?: string | null): string | null =>
  token && /^[A-Za-z0-9_-]{32,64}$/.test(token) ? `${FUNCTIONS_BASE}/functions/v1/event-pass-qr?t=${encodeURIComponent(token)}` : null

// ── Palette ──
export const K = {
  page: '#000000',
  card: '#0B0D13',
  panel: '#11141B',
  line: '#1A1E28',
  edge: '#2A2F3A',
  white: '#FFFFFF',
  ink: '#05070D',
  muted: '#A8B0C0',
  dim: '#7C8393',
  faint: '#55606F',
  accent: '#FF2DA1',
  violet: '#A516C5',
  violetText: '#D98AEE',
}
const BRAND_GRADIENT = 'linear-gradient(135deg, #4012F8 0%, #A516C5 35%, #F62489 65%, #FFA722 100%)'
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif"

// ── The holo card ──
export interface KretopiaEmailProps {
  /** Inbox preview text. */
  preview: string
  /** Small violet pill above the title. */
  eyebrow?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional image above the pill (the Kreto mascot). */
  hero?: React.ReactNode
  children?: React.ReactNode
  /** Buttons, centred under the body. */
  actions?: React.ReactNode
  /** Small muted text at the bottom of the card. */
  note?: React.ReactNode
}

export const KretopiaEmail = ({ preview, eyebrow, title, subtitle, hero, children, actions, note }: KretopiaEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: K.page, margin: 0, padding: '24px 12px', fontFamily: FONT }}>
      <Container style={{ maxWidth: '520px', margin: '0 auto' }}>
        {/* hairline frame in the brand gradient (flat #2A2F3A where gradients aren't supported) */}
        <div style={{ padding: '1px', borderRadius: '25px', backgroundColor: K.edge, backgroundImage: BRAND_GRADIENT }}>
          <div style={{ borderRadius: '24px', backgroundColor: K.card, overflow: 'hidden' }}>
            {/* header: violet halo + a faint holographic sheen */}
            <div
              style={{
                padding: '30px 26px 22px',
                textAlign: 'center',
                backgroundColor: K.card,
                backgroundImage:
                  'linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 65%), radial-gradient(75% 95% at 50% 0%, rgba(165,22,197,0.30) 0%, rgba(165,22,197,0) 70%)',
              }}
            >
              <table role="presentation" align="center" cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'middle', paddingRight: '9px' }}>
                      <Img src={K_MARK_URL} width="30" height="30" alt="" style={{ display: 'block' }} />
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <Img src={WORDMARK_URL} width="90" height="30" alt="Kretopia" style={{ display: 'block' }} />
                    </td>
                  </tr>
                </tbody>
              </table>
              {hero && <div style={{ margin: '16px 0 0' }}>{hero}</div>}
              {eyebrow && (
                <div style={{ margin: '18px 0 0' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      border: '1px solid rgba(165,22,197,0.45)',
                      backgroundColor: 'rgba(165,22,197,0.12)',
                      color: K.violetText,
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {eyebrow}
                  </span>
                </div>
              )}
              <Heading style={{ margin: '14px 0 0', fontSize: '26px', lineHeight: '33px', fontWeight: 800, color: K.white }}>{title}</Heading>
              {subtitle && <Text style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '21px', color: K.muted }}>{subtitle}</Text>}
            </div>

            {/* ticket perforation with the two punched notches */}
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td width="9" style={{ width: '9px', height: '18px', backgroundColor: K.page, borderRadius: '0 9px 9px 0', fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                  <td style={{ height: '9px', verticalAlign: 'top', borderBottom: `1px dashed ${K.edge}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                  <td width="9" style={{ width: '9px', height: '18px', backgroundColor: K.page, borderRadius: '9px 0 0 9px', fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            {children && <div style={{ padding: '14px 26px 4px' }}>{children}</div>}
            {actions && <div style={{ padding: '8px 26px 8px', textAlign: 'center' }}>{actions}</div>}

            <div style={{ padding: '18px 26px 24px', textAlign: 'center' }}>
              {note && <div style={{ margin: '0 0 14px', fontSize: '12px', lineHeight: '19px', color: K.dim }}>{note}</div>}
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: K.faint }}>
                Kretopia · Where Creativity Lives
              </div>
            </div>
          </div>
        </div>
        <Text style={{ margin: '14px 0 0', textAlign: 'center', fontSize: '11px', color: K.faint }}>
          © {new Date().getFullYear()} Kretopia · <Link href={SITE_URL} style={{ color: K.faint, textDecoration: 'underline' }}>kretopia.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

// ── Blocks ──
export const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <Text style={{ margin: '0 0 14px', fontSize: '15px', lineHeight: '24px', color: K.muted, ...style }}>{children}</Text>
)
export const B = ({ children }: { children: React.ReactNode }) => <strong style={{ color: K.white }}>{children}</strong>
export const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} style={{ color: K.white, textDecoration: 'underline' }}>{children}</Link>
)
export const Small = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <Text style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: '19px', color: K.dim, ...style }}>{children}</Text>
)

export const Panel = ({ label, children }: { label?: string; children: React.ReactNode }) => (
  <div style={{ backgroundColor: K.panel, border: `1px solid ${K.line}`, borderRadius: '16px', padding: '16px 18px', margin: '0 0 14px' }}>
    {label && (
      <div style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: K.dim }}>{label}</div>
    )}
    {children}
  </div>
)

/** Label above a value, stacked: the pass-style fact. */
export const Fact = ({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) => (
  <div style={{ margin: '0 0 10px' }}>
    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: K.dim }}>{label}</div>
    <div style={{ margin: '2px 0 0', fontSize: strong ? '20px' : '14px', lineHeight: '21px', fontWeight: strong ? 800 : 600, color: strong ? K.accent : K.white }}>{children}</div>
  </div>
)

/** Label / value rows in two columns (event date, time, venue). */
export const FactRows = ({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) => (
  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', width: '100%' }}>
    <tbody>
      {rows.map((r) => (
        <tr key={r.label}>
          <td style={{ width: '64px', padding: '6px 12px 6px 0', verticalAlign: 'top', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: K.dim }}>{r.label}</td>
          <td style={{ padding: '6px 0', verticalAlign: 'top', fontSize: '14px', fontWeight: 600, color: K.white }}>{r.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

export const Quote = ({ children }: { children: React.ReactNode }) => (
  <div style={{ backgroundColor: K.panel, border: `1px solid ${K.line}`, borderRadius: '16px', padding: '14px 18px', margin: '0 0 14px', fontSize: '15px', lineHeight: '23px', fontStyle: 'italic', color: K.muted }}>
    {children}
  </div>
)

/** Dark-amber notice (warning token family). */
export const Notice = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ backgroundColor: '#1F1A0E', border: '1px solid #4B3A12', borderRadius: '16px', padding: '14px 16px', margin: '0 0 14px' }}>
    <div style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#F2C14E' }}>{title}</div>
    <div style={{ fontSize: '13px', lineHeight: '19px', color: '#F2C14E' }}>{children}</div>
  </div>
)

/** One-time code, big and spaced. */
export const Code = ({ children }: { children: React.ReactNode }) => (
  <div style={{ margin: '4px 0 16px', textAlign: 'center', fontSize: '32px', fontWeight: 800, letterSpacing: '0.35em', color: K.accent, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" }}>{children}</div>
)

// ── Buttons ──
/** The canonical CTA (CtaButton / .cta-solid): flat --primary fill (white in dark), --primary-foreground text, lg radius. */
export const Cta = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <div style={{ margin: '4px 0 10px' }}>
    <Button
      href={href}
      style={{
        backgroundColor: K.white, color: K.ink, fontSize: '14px', lineHeight: '20px', fontWeight: 600, borderRadius: '16px',
        padding: '14px 32px', textDecoration: 'none', display: 'inline-block',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
      }}
    >
      {children}
    </Button>
  </div>
)
export const Ghost = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <div style={{ margin: '4px 0 10px' }}>
    <Button
      href={href}
      style={{
        backgroundColor: 'transparent', color: K.white, fontSize: '13px', lineHeight: '18px', fontWeight: 600, borderRadius: '12px',
        border: '1px solid #3A4152', padding: '10px 20px', textDecoration: 'none', display: 'inline-block',
      }}
    >
      {children}
    </Button>
  </div>
)

// ── Pass QR + people ──
export const PassQr = ({ token, alt = 'Your Kretopia check-in QR code' }: { token?: string | null; alt?: string }) => {
  const src = passQrUrl(token)
  return src ? <Img src={src} width="200" height="200" alt={alt} style={{ margin: '4px auto 8px' }} /> : null
}

export const Person = ({ name, role, avatar }: { name: string; role?: string | null; avatar?: string | null }) => (
  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 8px' }}>
    <tbody>
      <tr>
        <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
          {avatar ? (
            <Img src={avatar} width="36" height="36" alt="" style={{ borderRadius: '999px', display: 'block' }} />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '999px', backgroundColor: '#222838', color: K.white, textAlign: 'center', lineHeight: '36px', fontWeight: 700 }}>
              {(name || '?').slice(0, 1)}
            </div>
          )}
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: K.white }}>{name}</div>
          {role && <div style={{ fontSize: '12px', color: K.dim }}>{role}</div>}
        </td>
      </tr>
    </tbody>
  </table>
)
