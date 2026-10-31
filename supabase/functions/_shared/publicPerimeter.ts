import { createClient } from 'npm:@supabase/supabase-js@2';
import { rateLimit } from './guard.ts';

/**
 * Perimeter for public-by-design endpoints (no JWT): meter by caller IP so a
 * single source cannot hammer a paid or resource-heavy path. Fails closed:
 * when metering cannot be verified the request is denied, never allowed.
 *
 * Identity is the client IP from x-forwarded-for (Supabase edge runtime sets
 * it), hashed inside rateLimit before it touches the ledger — no raw IPs are
 * stored.
 */
export async function publicPerimeter(req: Request, feature: string, perMinute = 10): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Public perimeter configuration unavailable');
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const identity = forwarded && forwarded.length <= 64 ? forwarded : 'unknown';
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await rateLimit(admin, `ip:${identity}`, `public:${feature}`, perMinute);
}
