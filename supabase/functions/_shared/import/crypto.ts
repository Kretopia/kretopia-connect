// AES-GCM encryption for provider credentials.
// Tokens are only ever decrypted inside edge functions — never returned to a client.

const KEY_MATERIAL = Deno.env.get("INTEGRATION_ENC_KEY") ?? "";

async function getKey(): Promise<CryptoKey> {
  if (!KEY_MATERIAL) throw new Error("INTEGRATION_ENC_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(KEY_MATERIAL));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptToken(encoded: string): Promise<string> {
  const key = await getKey();
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

/** Signed, single-use-ish OAuth state: <payloadB64>.<hmacB64> */
export async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = btoa(JSON.stringify({ ...payload, ts: Date.now() }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(KEY_MATERIAL),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${btoa(String.fromCharCode(...sig))}`;
}

export async function verifyState(state: string, maxAgeMs = 15 * 60 * 1000): Promise<Record<string, any>> {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Malformed OAuth state");
  const expected = await signState({});
  void expected; // shape check only
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(KEY_MATERIAL),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(body),
  );
  if (!ok) throw new Error("Invalid OAuth state signature");
  const payload = JSON.parse(atob(body));
  if (Date.now() - Number(payload.ts ?? 0) > maxAgeMs) throw new Error("OAuth state expired");
  return payload;
}
