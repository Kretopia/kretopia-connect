import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser, rateLimit } from './guard.ts';

/** Validate against the backend that owns the account; meter on this deployment.
 * Never fall back after an auth failure or trust a client-selected backend URL.
 */
export async function requireAiCaller(req: Request, feature: string): Promise<void> {
  const deploymentUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const legacyUrl = Deno.env.get('LEGACY_SUPABASE_URL');
  const accountUrl = legacyUrl || deploymentUrl;
  const accountKey = legacyUrl
    ? Deno.env.get('LEGACY_SUPABASE_ANON_KEY')
    : Deno.env.get('SUPABASE_ANON_KEY');
  if (!accountUrl || !accountKey || !deploymentUrl || !serviceKey) {
    throw new Error('AI perimeter configuration unavailable');
  }
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const accountClient = createClient(accountUrl, accountKey, options);
  const user = await requireUser(req, accountClient);
  const admin = createClient(deploymentUrl, serviceKey, options);
  await rateLimit(admin, user.id, feature, 20);
}