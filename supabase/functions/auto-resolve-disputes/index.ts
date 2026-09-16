import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron-driven: auto-resolves disputes where the owner did not respond
 * within the auto_resolve_at deadline (default 7 days). Transfers credit
 * ownership to the challenger.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: stalled, error } = await admin
      .from("credit_claim_disputes")
      .select("id, credit_id, challenger_id, current_owner_id, auto_resolve_at")
      .eq("status", "pending")
      .is("owner_responded_at", null)
      .lte("auto_resolve_at", new Date().toISOString())
      .limit(50);

    if (error) throw error;

    const results: Array<{ id: string; outcome: string; error?: string }> = [];

    for (const d of stalled || []) {
      try {
        // Transfer credit ownership to challenger
        const { error: updErr } = await admin
          .from("credits")
          .update({ user_id: d.challenger_id as string })
          .eq("id", d.credit_id as string);
        if (updErr) throw updErr;

        const { error: resErr } = await admin
          .from("credit_claim_disputes")
          .update({
            status: "resolved_for_challenger",
            resolution_note: "Auto-resolved: owner did not respond within 7 days.",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", d.id as string);
        if (resErr) throw resErr;

        results.push({ id: d.id as string, outcome: "transferred_to_challenger" });
      } catch (e) {
        results.push({
          id: d.id as string,
          outcome: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: stalled?.length || 0, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[auto-resolve-disputes] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
