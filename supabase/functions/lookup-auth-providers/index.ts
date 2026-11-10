import { corsFor, safeError } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';

/**
 * Retired account lookup. It used to tell anonymous callers whether an email
 * had an account and which sign-in providers it used, which let anyone
 * enumerate accounts. It now validates input and always answers the same
 * neutral shape, so the sign-in form falls back to its generic options.
 */
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await publicPerimeter(req, "lookup-auth-providers", 10);
    const { email } = await req.json().catch(() => ({}));
    const target = (typeof email === "string" ? email : "").trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return json(corsHeaders, { error: "valid email required" }, 400);
    }
    return json(corsHeaders, { exists: false, providers: [], masked_email: null });
  } catch (e) {
    return safeError(e, req);
  }
});

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
