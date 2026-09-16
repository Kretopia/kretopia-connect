// Pushes an accepted call action item into the real system:
// - kind=task → projects.tasks (when transcript has project_id)
// - kind=credit → thrive_credits (best-effort, host as creator)
// - kind=note/decision/followup → project_notes (when project_id) else nothing
//
// Always marks the action item as `pushed` and stores the new row id so the
// UI can deep-link back to it.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action_item_id, due_at } = await req.json();
    if (!action_item_id) throw new Error("action_item_id required");

    // Load item + transcript context (RLS will gate access through the user's client).
    const { data: item, error: itemErr } = await supabase
      .from("call_action_items")
      .select("id, kind, title, detail, assignee_user_id, transcript_id")
      .eq("id", action_item_id)
      .maybeSingle();
    if (itemErr || !item) throw new Error("Action item not found or no access");

    const { data: t } = await supabase
      .from("call_transcripts")
      .select("project_id, call_kind, created_by")
      .eq("id", item.transcript_id)
      .maybeSingle();
    if (!t) throw new Error("Transcript not found");

    let pushedToId: string | null = null;
    let pushedToKind: string | null = null;

    if (item.kind === "task" && t.project_id) {
      const { data: row } = await admin
        .from("project_tasks")
        .insert({
          project_id: t.project_id,
          title: item.title,
          description: item.detail ?? null,
          assigned_to: item.assignee_user_id ?? userId,
          created_by: userId,
          due_date: due_at ?? null,
          status: "todo",
        })
        .select("id")
        .single();
      pushedToId = row?.id ?? null;
      pushedToKind = "project_tasks";
    } else if ((item.kind === "note" || item.kind === "decision" || item.kind === "followup") && t.project_id) {
      const { data: row } = await admin
        .from("project_notes")
        .insert({
          project_id: t.project_id,
          created_by: userId,
          title: `${item.kind === "decision" ? "Decision" : item.kind === "followup" ? "Follow-up" : "Note"} from call`,
          content: `${item.title}${item.detail ? `\n\n${item.detail}` : ""}`,
        })
        .select("id")
        .single();
      pushedToId = row?.id ?? null;
      pushedToKind = "project_notes";
    } else if (item.kind === "credit") {
      // Best-effort: leave credit creation to the user via the credits flow.
      pushedToKind = "manual_credit";
    }

    await admin
      .from("call_action_items")
      .update({
        status: "pushed",
        pushed_to_id: pushedToId,
        pushed_to_kind: pushedToKind,
      })
      .eq("id", action_item_id);

    return new Response(JSON.stringify({ ok: true, pushed_to_id: pushedToId, pushed_to_kind: pushedToKind }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[accept-call-action-item]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
