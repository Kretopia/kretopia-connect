// send-outreach-draft
// Sends a previously-drafted outreach email via the user's connected Gmail (SMTP).
// Marks outreach_drafts.status='sent' and sponsor_leads.status='contacted'.
//
// Body: { draft_id: string, _agent_action_id?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
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
    if (draft.status === "sent") return json({ ok: true, alreadySent: true });

    const recipient = recipientOverride || draft.recipient_email;
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
