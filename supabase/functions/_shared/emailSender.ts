// Sender identity for transactional email, in ONE small file so pasting a newer
// send-transactional-email / auth-email-hook into a backend never overwrites
// which sender that backend is allowed to use.
//
//   main (this file)  -> Kretopia's own sender: noreply@kretopia.com signed by notify.kretopia.com
//   kretopia-app      -> the legacy backend keeps its own copy of THIS file with
//                        SENDER_DOMAIN = "notify.thrivein.io" and FROM_DOMAIN = "thrivein.io"
//                        until kretopia.com is verified and published in Cloud > Emails
//                        (every send failed with sender_domain_mismatch / no_matching_sender
//                        from 2026-08-17 to 2026-10-07 when the pair did not match a verified domain).
//
// The two values must belong together: FROM_DOMAIN is the root of SENDER_DOMAIN.
// Optional secrets EMAIL_SENDER_DOMAIN / EMAIL_FROM_DOMAIN still override, but they did not take effect
// reliably on the legacy backend (2026-10-08), so do not rely on them there.
export const SENDER_DOMAIN: string = Deno.env.get('EMAIL_SENDER_DOMAIN') || 'notify.kretopia.com'
export const FROM_DOMAIN: string = Deno.env.get('EMAIL_FROM_DOMAIN') || 'kretopia.com'
