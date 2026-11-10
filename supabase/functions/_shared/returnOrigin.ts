// The origin a payment provider sends the buyer back to. Only our own app
// hosts are accepted; anything else (or no Origin header) falls back to the
// primary domain, so a caller cannot turn a checkout into an open redirect.

export const PRIMARY_APP_ORIGIN = "https://www.kretopia.com";

const EXACT_HOSTS = new Set([
  "www.kretopia.com",
  "kretopia.com",
  "kretopia-app.lovable.app",
]);
const PROJECT_ID = "e93234f9-d5f6-43f5-a829-8b44988f2980";

export function isTrustedAppOrigin(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.port || u.username || u.password || u.origin !== raw) return false;
    if (EXACT_HOSTS.has(u.hostname)) return true;
    // This project's own preview hosts only, never any other lovable app.
    return (u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".lovableproject.com")) &&
      u.hostname.includes(PROJECT_ID);
  } catch {
    return false;
  }
}

export function trustedReturnOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  return isTrustedAppOrigin(origin) ? origin! : PRIMARY_APP_ORIGIN;
}
