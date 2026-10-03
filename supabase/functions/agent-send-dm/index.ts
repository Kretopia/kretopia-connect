// agent-send-dm
// Lightweight handler invoked by the agent-orchestrator when a user approves a
// `send_dm` action. Inserts a row into public.messages as the authenticated user
// (RLS-safe via their JWT), so the recipient sees a normal direct message.
//
// "One authority, two doors": this endpoint sends AI-composed text under the
// caller's identity, and (unlike copilot-collaborator-tools) has no
// legitimate direct human-UI caller today -- the app's normal "send a
// message" flow inserts into public.messages itself, it doesn't call this
// function. So the only thing that should ever be able to invoke it is
// agent-orchestrator, after a human has approved that specific action. This
// was previously reachable by anyone holding the user's own JWT with zero
// approval linkage at all; it now requires proof of an approved orch_actions
// row belonging to the caller. See _shared/agentAuthority.ts for the same
// pattern applied to copilot-collaborator-tools.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { evaluateExecutionGuard } from "../_shared/executionGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const senderId = userData.user.id;

    const body = await req.json().catch(() => ({}));

    // Require proof that a human approved this specific send -- see module
    // doc above. The referenced orch_actions row just has to belong to this
    // user and be approved (an already-executed action is rejected so it can't
    // be replayed); we don't require its tool_name to be
    // exactly "send_dm" because the only legitimate caller today
    // (executeSpinUpProject) sends its kickoff DM as one step of an
    // already-approved "spin_up_project" bundle, not a standalone action.
    //
    // The decision itself lives in _shared/executionGuard.ts: the action must
    // belong to the caller, be exactly 'approved' (an already 'executed' action
    // can no longer be replayed), and carry an orch_approvals record by the
    // caller with no rejected/revoked/cancelled record. When that can't be
    // proven nothing is sent: the caller gets a "needs approval" result that
    // includes the draft, so the user can still see what would have gone out.
    const agentActionId = body._agent_action_id ? String(body._agent_action_id) : null;
    const draft = {
      to_user_id: String(body.to_user_id ?? "").trim(),
      body: String(body.body ?? "").trim(),
    };
    const blocked = (status: number, reason: string, needsApproval: boolean, message: string) =>
      new Response(
        JSON.stringify({ ok: false, executed: false, needs_approval: needsApproval, reason, error: message, draft }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    if (!agentActionId) {
      return blocked(
        428,
        "no_action",
        true,
        "This endpoint requires an approved agent action (_agent_action_id). " +
          "Route DM sends through agent-orchestrator's proposal/approval flow.",
      );
    }
    {
      const SERVICE_KEY_CHECK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminCheck = createClient(SUPABASE_URL, SERVICE_KEY_CHECK);
      const [actionRes, approvalsRes] = await Promise.all([
        adminCheck.from("orch_actions").select("id, user_id, status, tool_name").eq("id", agentActionId).maybeSingle(),
        adminCheck.from("orch_approvals").select("action_id, user_id, decision").eq("action_id", agentActionId),
      ]);
      // A failed approvals lookup must not read as "no revocation": deny.
      if (approvalsRes.error) {
        return blocked(503, "approval_lookup_failed", false, "Could not verify the approval for this action.");
      }
      const verdict = evaluateExecutionGuard({
        action: actionRes.error ? null : actionRes.data,
        approvals: approvalsRes.data,
        userId: senderId,
        actionId: agentActionId,
      });
      if (!verdict.allowed) {
        const status =
          verdict.reason === "action_not_found" ? 404
          : verdict.reason === "wrong_owner" || verdict.reason === "wrong_tool" ? 403
          : verdict.needsApproval ? 428
          : 409;
        return blocked(status, verdict.reason, verdict.needsApproval, verdict.message);
      }
    }

    const to_user_id = String(body.to_user_id ?? "").trim();
    const messageBody = String(body.body ?? "").trim();

    if (!to_user_id || !messageBody) {
      return new Response(
        JSON.stringify({ error: "to_user_id and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (to_user_id === senderId) {
      return new Response(
        JSON.stringify({ error: "Cannot DM yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (messageBody.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Message too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guard against hallucinated recipient ids: validate that to_user_id
    // actually exists in auth.users before insert (messages.receiver_id has FK).
    try {
      const SERVICE_KEY_PRECHECK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminCheck = createClient(SUPABASE_URL, SERVICE_KEY_PRECHECK);
      const { data: rec, error: recErr } = await adminCheck.auth.admin.getUserById(to_user_id);
      if (recErr || !rec?.user) {
        return new Response(
          JSON.stringify({ error: "That user account doesn't exist. Look them up by name first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      console.warn("recipient validation failed", e);
    }

    const { data: inserted, error } = await userClient
      .from("messages")
      .insert({
        sender_id: senderId,
        receiver_id: to_user_id,
        content: messageBody,
        read: false,
      })
      .select("id")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Best-effort: notify recipient (push + email). Do not block.
    try {
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: senderProfile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", senderId)
        .maybeSingle();
      const senderName = senderProfile?.full_name ?? "Someone";
      const preview = messageBody.length > 80 ? messageBody.slice(0, 80) + "…" : messageBody;

      admin.functions.invoke("send-push-notification", {
        body: {
          userId: to_user_id,
          title: `${senderName} sent you a message`,
          body: preview,
          tag: "dm",
          data: { url: "/messages" },
        },
      }).catch(() => {});

      admin.functions.invoke("send-user-email", {
        body: { type: "message", recipientId: to_user_id, data: { messagePreview: preview } },
      }).catch(() => {});
    } catch {
      // ignore notification failures — message is already delivered
    }

    return new Response(
      JSON.stringify({ ok: true, message_id: inserted?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("agent-send-dm error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
