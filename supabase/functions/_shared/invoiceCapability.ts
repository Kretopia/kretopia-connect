// Per-invoice payment-link capability: HMAC-SHA256(invoiceId) keyed from a server-only secret.
// No schema change needed; the token rides in the link the issuer sends (?t=...), and
// invoice-pay-info / create-invoice-checkout refuse requests without a valid one.
const enc = new TextEncoder();

async function key(): Promise<CryptoKey> {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  const secret = env?.get("INVOICE_LINK_SECRET") || env?.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Invoice link signing unavailable");
  return crypto.subtle.importKey("raw", enc.encode(`invoice-pay-link:v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function signInvoiceLink(invoiceId: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(invoiceId.toLowerCase()));
  return b64url(sig).slice(0, 32);
}

export async function verifyInvoiceLink(invoiceId: string, token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== "string" || token.length !== 32) return false;
  const expected = await signInvoiceLink(invoiceId);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export const invoicePayUrl = (invoiceId: string, token: string) =>
  `https://www.kretopia.com/pay/invoice/${invoiceId}?t=${encodeURIComponent(token)}`;
