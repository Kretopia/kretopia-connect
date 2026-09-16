import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Public pre-flight lookup so the sign-in form can guide users to the right
 * provider BEFORE they fail a password attempt or accidentally create a 2nd account.
 *
 * Returns:
 *   { exists, providers: ('email'|'google'|'apple'|...)[], masked_email }
 * Never returns the raw email or any user-identifying info beyond the providers
 * the caller already typed.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { email } = await req.json().catch(() => ({}));
    const target = (email || "").trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return json({ error: "valid email required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Walk pages — most projects fit in one page; cap to 5 pages (5000 users) for safety.
    let found: any = null;
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      found = data?.users?.find((u) => u.email?.toLowerCase() === target);
      if (found || !data?.users?.length || data.users.length < 1000) break;
    }

    if (!found) return json({ exists: false, providers: [], masked_email: null });

    const providers = Array.from(
      new Set(
        (found.identities || [])
          .map((i: any) => i.provider)
          .filter(Boolean),
      ),
    );
    // If they have a password set but no "email" identity yet (older accounts),
    // still surface "email" so we point them to the password field.
    if (!providers.includes("email") && found.encrypted_password) {
      providers.push("email");
    }

    return json({
      exists: true,
      providers,
      masked_email: maskEmail(target),
    });
  } catch (e) {
    console.error("[lookup-auth-providers]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function maskEmail(e: string) {
  const [l, d] = e.split("@");
  if (!l || !d) return e;
  const visible = l.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, l.length - 2))}@${d}`;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
