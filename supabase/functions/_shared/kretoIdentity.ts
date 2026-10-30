import { createClient } from 'npm:@supabase/supabase-js@2';

// Accept only server-validated sessions. A legacy subject remains a legacy
// identity; it is never treated as a Cloud auth row or upgraded to service role.
export async function resolveKretoIdentity(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [^\s,]+$/.test(authorization)) return null;
  const endpoints = [
    { url: Deno.env.get('LEGACY_SUPABASE_URL'), key: Deno.env.get('LEGACY_SUPABASE_ANON_KEY'), legacy: true },
    { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_ANON_KEY'), legacy: false },
  ];
  for (const endpoint of endpoints) {
    if (!endpoint.url || !endpoint.key) continue;
    const client = createClient(endpoint.url, endpoint.key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (!error && data.user) return { id: data.user.id, client, legacy: endpoint.legacy, url: endpoint.url, key: endpoint.key, authorization };
  }
  return null;
}