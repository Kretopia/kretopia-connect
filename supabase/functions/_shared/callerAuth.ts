// Who is calling this edge function? Independent of the gateway's "Verify JWT"
// switch, which only proves the bearer is *a* valid JWT: the public anon key
// is one, so "verify_jwt = true" never meant "signed-in".
//
//   service   -> the bearer IS the project's service-role key (server to server)
//   user      -> a real session, verified against Auth (getUser), not decoded
//   anonymous -> everything else, including the public anon key
//
// Kept free of URL imports so it can be unit-tested with vitest.

export type Caller =
  | { kind: "service" }
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "anonymous" };

type AuthClient = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null } | null;
      error: unknown;
    }>;
  };
};

/** Constant-time string comparison (length is not hidden, content is). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+([^\s,]+)$/i.exec(req.headers.get("Authorization") ?? "");
  return m ? m[1] : null;
}

export async function identifyCaller(
  req: Request,
  deps: { serviceRoleKey: string | undefined | null; admin: AuthClient },
): Promise<Caller> {
  const token = bearerToken(req);
  if (!token) return { kind: "anonymous" };

  if (deps.serviceRoleKey && timingSafeEqualStr(token, deps.serviceRoleKey)) {
    return { kind: "service" };
  }

  try {
    const { data, error } = await deps.admin.auth.getUser(token);
    const user = data?.user;
    if (!error && user?.id) return { kind: "user", userId: user.id, email: user.email ?? null };
  } catch {
    // fall through: an unverifiable token is anonymous, never trusted
  }
  return { kind: "anonymous" };
}
