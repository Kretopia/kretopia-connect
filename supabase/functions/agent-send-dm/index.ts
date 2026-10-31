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
import { bindApprovedDm } from "../_shared/agentDmBinding.ts";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
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

    // Require proof that a human approved THIS send -- see module doc above.
    //
    // The referenced orch_actions row must belong to the caller, be exactly
    // 'approved' (an already 'executed' action can no longer be replayed), carry
    // an orch_approvals record by the caller with no rejected/revoked/cancelled
    // record, be fresh (30 minutes), and -- new -- it must name exactly this
    // recipient and exactly this text: a standalone `send_dm` action, or the
    // `spin_up_project` bundle whose kickoff DM this is. The decision lives in
    // _shared/agentDmBinding.ts (it composes _shared/executionGuard.ts). When it
    // cannot be proven nothing is sent: the caller gets a "needs approval" or a
    // refusal that includes the draft, so the user can still see what would have
    // gone out.
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
    // The approval must be for exactly this message: the caller's own action,
    // still 'approved', unrevoked and fresh, naming THIS recipient and THIS
    // text (the arguments the orchestrator runs: the approving record's
    // edited_args, else the action's tool_args). A different recipient, a
    // different text, an expired approval or an unsupported tool is a hard
    // deny. See _shared/agentDmBinding.ts.
    const adminDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    {
      const [actionRes, approvalsRes] = await Promise.all([
        adminDb
          .from("orch_actions")
          .select("id, user_id, status, tool_name, tool_args, decided_at")
          .eq("id", agentActionId)
          .maybeSingle(),
        adminDb
          .from("orch_approvals")
          .select("id, action_id, user_id, decision, edited_args, decided_at")
          .eq("action_id", agentActionId),
      ]);
      // A failed lookup must not read as "not found" or "no revocation": deny.
      if (actionRes.error || approvalsRes.error) {
        return blocked(503, "approval_lookup_failed", false, "Could not verify the approval for this action.");
      }
      const verdict = bindApprovedDm({
        action: actionRes.data,
        approvals: approvalsRes.data,
        userId: senderId,
        actionId: agentActionId,
        request: draft,
        nowMs: Date.now(),
      });
      if (!verdict.allowed) {
        return blocked(verdict.status, verdict.reason, verdict.status === 428, verdict.message);
      }
      console.log("[agent-send-dm] approved send", { actionId: agentActionId, approvalId: verdict.approvalId });
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

    // One approved action sends at most once. Claim it (approved -> executed,
    // compare-and-set) before anything is inserted: a second call with the same
    // action id, a retry or a double click, finds it already claimed and sends
    // nothing. The orchestrator's own final update to 'executed' or 'failed'
    // still applies after this.
    const { data: claimed, error: claimErr } = await adminDb
      .from("orch_actions")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", agentActionId)
      .eq("status", "approved")
      .select("id");
    if (claimErr) {
      return blocked(503, "claim_failed", false, "Could not reserve this action for sending.");
    }
    if (!claimed || claimed.length === 0) {
      return blocked(409, "already_executed", false, "This action has already run; it cannot be sent again.");
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
      // Nothing was delivered: release the claim so the approved send can be retried.
      await adminDb
        .from("orch_actions")
        .update({ status: "approved", executed_at: null })
        .eq("id", agentActionId)
        .eq("status", "executed");
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
