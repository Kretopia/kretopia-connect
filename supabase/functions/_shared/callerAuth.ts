// Verified caller identity for edge functions.
//
// Never trusts a decoded-but-unverified JWT: a service caller must present the
// exact service-role secret configured for this function, and a user caller
// must present a token the auth server accepts (auth.getUser). The publishable
// (anon) key is NOT an identity — it resolves to no user and is refused.

export type Caller =
  | { kind: "service" }
  | { kind: "user"; userId: string; email: string | null };

export type CallerDeps = {
  env: (name: string) => string | undefined;
  getUser?: (token: string) => Promise<{ id: string; email?: string | null } | null>;
};

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 && t.length <= 8192 ? t : null;
}

const defaultDeps = (): CallerDeps => ({
  env: (n) => (globalThis as unknown as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env.get(n),
});

export async function resolveCaller(req: Request, deps: CallerDeps = defaultDeps()): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) return null;
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && timingSafeEqualString(token, serviceKey)) return { kind: "service" };
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  if (anonKey && timingSafeEqualString(token, anonKey)) return null;

  // Default: ask the auth server to validate the token (signature, expiry,
  // revocation). A locally decoded payload is never accepted.
  const getUser = deps.getUser ?? (async (t: string) => {
    const base = deps.env("SUPABASE_URL");
    if (!base || !anonKey) return null;
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return null;
    const u = await res.json().catch(() => null) as { id?: string; email?: string | null } | null;
    return u?.id ? { id: u.id, email: u.email ?? null } : null;
  });
  try {
    const user = await getUser(token);
    return user?.id ? { kind: "user", userId: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Subject authorization for service-role handlers that act on a user_id.
 * - service caller: refused by default; route must opt into its internal subject contract
 * - user caller: only their own user_id (an omitted id means "self")
 * - otherwise: refused (callers may still fall back to admin/cron guards)
 */
export function authorizeSubject(
  caller: Caller | null,
  requestedUserId: unknown,
  options: { allowService?: boolean } = {},
): { ok: true; userId: string | null } | { ok: false; status: 401 | 403 } {
  if (!caller) return { ok: false, status: 401 };
  if (caller.kind === "service") {
    if (!options.allowService) return { ok: false, status: 403 };
    return { ok: true, userId: typeof requestedUserId === "string" ? requestedUserId : null };
  }
  if (requestedUserId != null && requestedUserId !== caller.userId) return { ok: false, status: 403 };
  return { ok: true, userId: caller.userId };
}
