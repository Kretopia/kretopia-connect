// create-agent-proposal
//
// agent_proposals has no client INSERT policy — only service_role (edge
// functions like money-agent-watch) can write to it, by design, so a
// client can never inject a fake "AI suggestion" into someone's feed.
// This function is the one safe, narrow door for a client to ask for a
// real proposal to be queued on their own behalf: it verifies the caller
// owns the project, then inserts with the service-role client. It only
// ever creates a pending proposal — never accepts, executes, or sends
// anything itself.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_KINDS = new Set([
  "draft_invoice", "schedule_followup", "next_milestone", "wrap_project", "collab_nudge", "other",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, kind, title, proposal_body, action_intent, source_signal } = body ?? {};
    if (!project_id || !kind || !title || !proposal_body || !VALID_KINDS.has(kind)) {
      return new Response(JSON.stringify({ error: "project_id, kind, title and proposal_body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Ownership check — re-derived server-side, never trusted from the client.
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("created_by")
      .eq("id", project_id)
      .single();
    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (project.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin.from("agent_proposals").insert({
      project_id,
      owner_user_id: user.id,
      kind,
      title: String(title).slice(0, 200),
      body: String(proposal_body).slice(0, 1000),
      status: "pending",
      action_intent: action_intent ?? {},
      source_signal: source_signal ?? {},
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, proposal: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("create-agent-proposal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
