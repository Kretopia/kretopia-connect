// Thin wrapper around vouch_on_credit RPC for the agent orchestrator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { corsFor } from '../_shared/guard.ts';
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireUser(
      req,
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!),
    );
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const body = await req.json().catch(() => ({}));
    const creditId = body?.credit_id;
    if (!creditId || typeof creditId !== "string") {
      return new Response(JSON.stringify({ error: "credit_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await client.rpc("vouch_on_credit", {
      _credit_id: creditId,
      _action: body?.action ?? "vouch",
      _note: body?.note ?? null,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
