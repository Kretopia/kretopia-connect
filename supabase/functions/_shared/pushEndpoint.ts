// Which web-push endpoints the server will POST to. Pure: imported by edge functions (Deno) and by tests (Vite).
//
// Why: send-push-notification POSTs to `endpoint`, the URL a browser reported when it subscribed, and that URL is stored by
// the member's own request. A member could register http://169.254.169.254/... or an internal service and have the server
// call it, with a signed VAPID header, every time they are notified. A browser's push endpoint always lives on its vendor's
// push service, so those hosts are the only ones accepted.
import { hostMatches } from "./ssrf.ts";

export const PUSH_SERVICE_HOSTS: readonly string[] = [
  "fcm.googleapis.com", // Chrome, Edge, Opera, Samsung Internet
  "updates.push.services.mozilla.com", // Firefox
  "*.push.services.mozilla.com",
  "*.push.apple.com", // Safari (web.push.apple.com)
  "*.notify.windows.com", // legacy Edge / Windows
];

export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  return hostMatches(url.hostname, [...PUSH_SERVICE_HOSTS]);
}
