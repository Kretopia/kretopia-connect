// send-outreach-draft
// Sends a previously-drafted outreach email via the user's connected Gmail (SMTP).
// Marks outreach_drafts.status='sent' and sponsor_leads.status='contacted'.
//
// Body: { draft_id: string, _agent_action_id?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { bindApprovedAction } from "../_shared/agentActionBinding.ts";
import { INVOICE_CHASE_COOLDOWN_MS, cooldownCutoffIso, decideInvoiceChase } from "../_shared/notificationGuards.ts";


import { corsFor } from '../_shared/guard.ts';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const token = auth.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await (userClient.auth as any).getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const draftId = body?.draft_id;
    const recipientOverride: string | undefined = body?.recipient_email;
    if (!draftId) return json({ error: "draft_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: draft, error: dErr } = await admin
      .from("outreach_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", userId)
      .maybeSingle();

    if (dErr || !draft) return json({ error: "Draft not found" }, 404);

    // Agent-initiated sends (agent-orchestrator passes _agent_action_id and
    // _source) must carry proof that a human approved this action; the rule
    // lives in _shared/agentActionBinding.ts (it composes _shared/executionGuard.ts).
    // Nothing is sent otherwise -- the
    // caller gets a "needs approval" result with the draft instead. A person
    // pressing Send in the app (no agent markers) is their own approval, as in
    // _shared/agentAuthority.ts. NOTE: the markers are caller-asserted, so this
    // gates well-behaved agent callers, not a caller that omits them.
    const agentActionId = body?._agent_action_id ? String(body._agent_action_id) : null;
    const claimedSource = String(body?._source ?? "").trim();
    const agentInitiated =
      !!agentActionId || claimedSource === "agent_orchestrator" || claimedSource === "desk_agent";
    if (agentInitiated) {
      const preview = { draft_id: draft.id, to: draft.recipient_email ?? null, subject: draft.subject, body: draft.body };
      const blocked = (status: number, reason: string, needsApproval: boolean, message: string) =>
        json({ ok: false, executed: false, needs_approval: needsApproval, reason, error: message, draft: preview }, status);
      if (!agentActionId) {
        return blocked(428, "no_action", true, "This send requires an approved agent action (_agent_action_id).");
      }
      const [actionRes, approvalsRes] = await Promise.all([
        admin
          .from("orch_actions")
          .select("id, user_id, status, tool_name, tool_args, decided_at")
          .eq("id", agentActionId)
          .maybeSingle(),
        admin
          .from("orch_approvals")
          .select("id, action_id, user_id, decision, edited_args, decided_at")
          .eq("action_id", agentActionId),
      ]);
      // A failed lookup must not read as "not found" or "no revocation": deny.
      if (actionRes.error || approvalsRes.error) {
        return blocked(503, "approval_lookup_failed", false, "Could not verify the approval for this action.");
      }
      // The approval must be for THIS send: the caller's own approved
      // `send_outreach_email` action (any other approved tool used to be
      // accepted here), with its approval record, unrevoked, fresh, and naming
      // THIS draft. An approved action that names no draft covers no draft: the
      // draft check used to be skipped when `draft_id` was absent.
      const verdict = bindApprovedAction({
        action: actionRes.data,
        approvals: approvalsRes.data,
        userId,
        actionId: agentActionId,
        toolName: "send_outreach_email",
        targets: { draft: { request: String(draftId), approvedKeys: ["draft_id"] } },
        nowMs: Date.now(),
      });
      if (!verdict.allowed) {
        return blocked(verdict.status, verdict.reason, verdict.status === 428, verdict.message);
      }
    }

    if (draft.status === "sent") return json({ ok: true, alreadySent: true });

    // A payment reminder (a draft made by send-invoice-chase) is for an invoice that is still owed,
    // and not twice in a day: a settled invoice or a reminder in the last 24 h is refused before
    // anything else is read or reserved. Other drafts are unaffected.
    const chaseInvoiceId =
      draft.source === "chase_invoice" && typeof draft.meta?.invoice_id === "string" ? draft.meta.invoice_id : null;
    let chaseInvoice: { id: string; reminder_sent_at: string | null } | null = null;
    if (chaseInvoiceId) {
      const { data: inv, error: invErr } = await admin
        .from("invoices")
        .select("id, status, paid_at, reminder_sent_at")
        .eq("id", chaseInvoiceId)
        .eq("issued_by", userId)
        .maybeSingle();
      if (invErr) return json({ error: "Could not check the invoice, try again shortly" }, 503);
      if (!inv) return json({ error: "Invoice not found" }, 404);
      const gate = decideInvoiceChase(inv, true, Date.now());
      if (!gate.ok) return json({ error: gate.error, reason: gate.reason }, gate.status);
      chaseInvoice = { id: inv.id, reminder_sent_at: inv.reminder_sent_at ?? null };
    }

    // An approved agent send goes to the address that was previewed; only a
    // person in the app may override the recipient.
    const recipient = agentInitiated ? draft.recipient_email : (recipientOverride || draft.recipient_email);
    if (!recipient) {
      await admin.from("outreach_drafts").update({ status: "failed", send_error: "No recipient email" }).eq("id", draftId);
      return json({ error: "No recipient email on draft. Add one then retry." }, 400);
    }

    const { data: settings } = await admin
      .from("user_email_settings")
      .select("provider, gmail_email, gmail_app_password, is_configured")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings?.is_configured || settings.provider !== "gmail" || !settings.gmail_email || !settings.gmail_app_password) {
      await admin.from("outreach_drafts").update({ status: "failed", send_error: "Gmail not connected" }).eq("id", draftId);
      return json({ error: "Connect your Gmail in Outreach settings first." }, 400);
    }

    // An agent send is one approval, one send: claim the action (approved ->
    // executed, compare-and-set) before anything leaves; released below if the
    // mail did not go.
    let releaseClaim: (() => Promise<void>) | null = null;
    if (agentInitiated && agentActionId) {
      const { data: claimed, error: claimErr } = await admin
        .from("orch_actions")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", agentActionId)
        .eq("status", "approved")
        .select("id");
      if (claimErr) return json({ ok: false, executed: false, reason: "claim_failed", error: "Could not reserve this action for sending." }, 503);
      if (!claimed || claimed.length === 0) {
        return json({ ok: false, executed: false, reason: "already_executed", error: "This action has already run; it cannot be sent again." }, 409);
      }
      releaseClaim = async () => {
        await admin
          .from("orch_actions")
          .update({ status: "approved", executed_at: null })
          .eq("id", agentActionId)
          .eq("status", "executed");
      };
    }

    // The reminder is claimed (compare-and-set on the invoice's reminder date) before the mail
    // leaves, so two clicks or two tabs cannot both send; the previous date is put back if it did not go.
    let releaseInvoiceClaim: (() => Promise<void>) | null = null;
    if (chaseInvoice) {
      const claimedAt = new Date().toISOString();
      const cutoff = cooldownCutoffIso(Date.now(), INVOICE_CHASE_COOLDOWN_MS);
      const previous = chaseInvoice.reminder_sent_at;
      const invoiceId = chaseInvoice.id;
      const { data: got, error: gotErr } = await admin
        .from("invoices")
        .update({ reminder_sent_at: claimedAt })
        .eq("id", invoiceId)
        .eq("issued_by", userId)
        .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${cutoff}`)
        .select("id");
      if (gotErr || !got || got.length === 0) {
        await releaseClaim?.();
        return gotErr
          ? json({ error: "Could not reserve this reminder, try again shortly" }, 503)
          : json({ error: "A reminder was already sent for this invoice in the last 24 hours.", reason: "reminder_recent" }, 409);
      }
      releaseInvoiceClaim = async () => {
        await admin
          .from("invoices")
          .update({ reminder_sent_at: previous })
          .eq("id", invoiceId)
          .eq("reminder_sent_at", claimedAt);
      };
    }

    await admin.from("outreach_drafts").update({ status: "sending" }).eq("id", draftId);

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;font-size:14px;line-height:1.6;">${
      String(draft.body).split("\n\n").map((p: string) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br>")}</p>`).join("")
    }</div>`;

    try {
      const client = new SMTPClient({
        connection: {
          hostname: "smtp.gmail.com",
          port: 465,
          tls: true,
          auth: { username: settings.gmail_email, password: settings.gmail_app_password },
        },
      });

      await client.send({
        from: settings.gmail_email,
        to: recipient,
        subject: draft.subject,
        content: draft.body,
        html,
      });
      await client.close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("SMTP send failed", msg);
      await releaseClaim?.();
      await releaseInvoiceClaim?.();
      await admin.from("outreach_drafts").update({ status: "failed", send_error: msg.slice(0, 500) }).eq("id", draftId);
      return json({ error: `Send failed: ${msg}` }, 500);
    }

    await admin
      .from("outreach_drafts")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipient_email: recipient, send_error: null })
      .eq("id", draftId);

    if (draft.lead_id) {
      await admin.from("sponsor_leads").update({ status: "contacted" }).eq("id", draft.lead_id).eq("user_id", userId);
    }

    return json({ ok: true, sent_to: recipient });
  } catch (e) {
    console.error("send-outreach-draft error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
