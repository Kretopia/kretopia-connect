// What an event pass QR carries, for the emails and for the function that draws their QR image.
//
// A QR is read by a phone's camera, outside the app. A bare check-in token there is just text: scanning the code in the
// confirmation email offered "255ec752…" to copy or share. So the code carries the public pass page, the same address the
// app's pass card encodes (src/lib/publicLink.ts, buildPassUrl), and the check-in desk reads the token out of it.
//
// No imports, on purpose: the edge functions and the app's tests (Node) both load this file.

export const PASS_SITE_URL = 'https://www.kretopia.com'

/** Real check-in tokens are 32 hex characters; this is what the QR endpoint has always accepted. */
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/
const EVENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isPassToken = (value: unknown): value is string => typeof value === 'string' && TOKEN_RE.test(value)
export const isEventId = (value: unknown): value is string => typeof value === 'string' && EVENT_ID_RE.test(value)

/** The public pass page of an event, carrying the pass token. It opens for a visitor who is not signed in. */
export const passPageUrl = (eventId: string, token: string): string =>
  `${PASS_SITE_URL}/event/${encodeURIComponent(eventId)}/pass?token=${encodeURIComponent(token)}`

/** The event id inside an event address (…/event/<id>, with or without what follows), or null. */
export function eventIdFromUrl(url: string | null | undefined): string | null {
  const id = url?.split('/event/')[1]?.split(/[?#/]/)[0]
  return isEventId(id) ? id.toLowerCase() : null
}

/**
 * What the pass QR encodes: the pass link when the event is known. Only a request without an event id (the image address in
 * an email sent before the code carried a link) still gets the token alone, so those emails keep working at the door.
 * Null when the token is not a pass token, or when an event id was given and is not one.
 */
export function passQrData(token: unknown, eventId?: unknown): string | null {
  if (!isPassToken(token)) return null
  if (eventId === undefined || eventId === null || eventId === '') return token
  return isEventId(eventId) ? passPageUrl(eventId.toLowerCase(), token) : null
}

/** The address of the QR image an email points at. `functionsBase` is the backend's URL. Null when there is no valid token. */
export function passQrImageUrl(functionsBase: string, token: unknown, eventId?: unknown): string | null {
  if (!isPassToken(token)) return null
  const event = isEventId(eventId) ? `&e=${encodeURIComponent(eventId.toLowerCase())}` : ''
  return `${functionsBase}/functions/v1/event-pass-qr?t=${encodeURIComponent(token)}${event}`
}
