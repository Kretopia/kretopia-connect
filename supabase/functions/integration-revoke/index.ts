import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { provider, connection_id, purge } = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let q = admin.from("integration_connections").select("id").eq("user_id", user.id);
    if (connection_id) q = q.eq("id", connection_id);
    if (provider) q = q.eq("provider", provider);
    const { data: rows } = await q;
    const ids = (rows ?? []).map((r: any) => r.id);
    if (!ids.length) return json({ ok: true, revoked: 0 });

    if (purge) {
      await admin.from("integration_connections").delete().in("id", ids);
    } else {
      await admin.from("integration_connections").update({
        revoked_at: new Date().toISOString(),
        connection_status: "revoked",
        encrypted_access_token: null,
        encrypted_refresh_token: null,
      }).in("id", ids);
    }

    return json({ ok: true, revoked: ids.length, purged: !!purge });
  } catch (e) {
    console.error("integration-revoke failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
