/** Shared edge perimeter. No SDK runtime import: callers supply their admin client. */
interface JsonSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

declare const Deno: { env: { get(name: string): string | undefined } };

export class GuardError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>, public headers: Record<string, string> = {}) {
    super(String(payload.error));
  }
  response(req?: Request): Response {
    return new Response(JSON.stringify(this.payload), { status: this.status, headers: { ...(req ? corsFor(req) : {}), ...this.headers, 'Content-Type': 'application/json' } });
  }
}

export function corsFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
  const origin = req.headers.get('Origin');
  if (!origin) return headers;
  try {
    const url = new URL(origin);
    const allowed = url.protocol === 'https:' && !url.port && !url.username && !url.password && url.origin === origin && (
      url.hostname === 'www.kretopia.com' || url.hostname === 'kretopia.com' ||
      url.hostname.endsWith('.lovable.app') || url.hostname.endsWith('.lovableproject.com')
    );
    if (allowed) headers['Access-Control-Allow-Origin'] = origin;
  } catch { /* An invalid origin is never reflected. */ }
  return headers;
}

interface AuthAdmin {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string; [key: string]: unknown } | null }; error: unknown }> };
}
interface RateAdmin {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export async function requireUser(req: Request, admin: AuthAdmin) {
  const match = req.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new GuardError(401, { error: 'Unauthorized' });
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data?.user?.id) throw new GuardError(401, { error: 'Unauthorized' });
  return data.user;
}

/** Hash to equal-length buffers before comparison; no early exit on a byte mismatch. */
export async function constantTimeEqual(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function requireServiceRole(req: Request): Promise<void> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !await constantTimeEqual(req.headers.get('Authorization') ?? '', `Bearer ${secret}`)) {
    throw new GuardError(401, { error: 'Unauthorized' });
  }
}

export async function readJson<T>(req: Request, schema: JsonSchema<T>, maxBytes = 64_000): Promise<T> {
  const declared = req.headers.get('Content-Length');
  if (declared && Number(declared) > maxBytes) throw new GuardError(413, { error: 'Request too large' });
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new GuardError(413, { error: 'Request too large' }); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new GuardError(400, { error: 'Invalid JSON' }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.') || '_root';
      (fields[field] ??= []).push(issue.message);
    }
    throw new GuardError(400, { error: 'Invalid input', fields });
  }
  return parsed.data;
}

/** Reuses the existing atomic usage ledger with a UTC minute-keyed bucket. */
export async function rateLimit(admin: RateAdmin, identity: string, key: string, perMinute: number): Promise<void> {
  if (!identity || !key || !Number.isInteger(perMinute) || perMinute < 1) throw new Error('Invalid limiter configuration');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)));
  const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const now = Date.now();
  const { data, error } = await admin.rpc('consume_ai_feature_call', { _user_id: uuid, _feature_key: `perimeter:${key}:${Math.floor(now / 60_000)}`, _daily_cap: perMinute });
  if (error) throw new Error('Usage verification unavailable');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object' || !('allowed' in row) || row.allowed !== true) {
    throw new GuardError(429, { error: 'Too many requests' }, { 'Retry-After': String(Math.max(1, Math.ceil((60_000 - now % 60_000) / 1000))) });
  }
}

export function safeError(error: unknown, req?: Request): Response {
  if (error instanceof GuardError) return error.response(req);
  console.error('Edge request failed', error);
  return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { ...(req ? corsFor(req) : {}), 'Content-Type': 'application/json' } });
}