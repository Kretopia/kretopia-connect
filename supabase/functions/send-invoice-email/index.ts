import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";


import { corsFor } from '../_shared/guard.ts';
import { cleanRecipientEmail } from "../_shared/outboundText.ts";
import { countActorSends, countRecipientSends, decideSendBudget, recordActorSend } from "../_shared/outboundBudget.ts";
import {
  decideInvoiceSend,
  INVOICE_EMAIL_TEMPLATE,
  INVOICE_EMAILS_PER_ACTOR_PER_HOUR,
  INVOICE_EMAILS_PER_RECIPIENT_PER_HOUR,
  isUuid,
  renderInvoiceEmail,
} from "../_shared/invoiceEmail.ts";

const MAX_BODY_BYTES = 8_000;

// Everything that can refuse runs BEFORE the provider is called: who is asking, whether the invoice is theirs and still open,
// whether the recipient is one plain address, whether the sending budget allows it. The mail carries our sender address and
// a payment button, so its content is escaped (_shared/invoiceEmail.ts) and a paid or cancelled invoice is never mailed again.
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const bearer = (req.headers.get("Authorization") ?? "").match(/^Bearer ([^\s]+)$/)?.[1];
    if (!bearer) return json({ error: "Unauthorized" }, 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const session = await db.auth.getUser(bearer);
    const user = session?.data?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
    let body: { invoiceId?: unknown; recipientEmail?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const invoiceId = body?.invoiceId;
    if (!isUuid(invoiceId)) return json({ error: "invoiceId is required" }, 400);
    const recipient = cleanRecipientEmail(body?.recipientEmail);
    if (!recipient) return json({ error: "A single valid recipient email is required" }, 400);

    const { data: invoice, error: invoiceError } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (invoiceError) return json({ error: "Could not load the invoice, try again shortly" }, 503);
    const decision = decideInvoiceSend(invoice, user.id);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const [actorCount, recipientCount] = await Promise.all([
      countActorSends(db, user.id, INVOICE_EMAIL_TEMPLATE),
      countRecipientSends(db, recipient, INVOICE_EMAIL_TEMPLATE),
    ]);
    const budget = decideSendBudget({
      actorCount,
      recipientCount,
      actorLimit: INVOICE_EMAILS_PER_ACTOR_PER_HOUR,
      recipientLimit: INVOICE_EMAILS_PER_RECIPIENT_PER_HOUR,
    });
    if (!budget.ok) return json({ error: budget.error }, budget.status);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "Email sending is not configured" }, 503);

    // The send is written down before it leaves, so it counts even if the provider answers late or not at all.
    const recorded = await recordActorSend(db, { template: INVOICE_EMAIL_TEMPLATE, actorId: user.id, recipientEmail: recipient, status: "sent" });
    if (!recorded) return json({ error: "Could not record the send, try again shortly" }, 503);

    const { subject, html } = renderInvoiceEmail(invoice, recipient);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Kretopia <noreply@kretopia.com>",
        to: [recipient],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      // The provider's answer can carry our key's account details: log the status, tell the caller nothing more than this.
      console.error("Invoice email was not accepted by the provider", emailResponse.status);
      return json({ error: "The email could not be sent, try again shortly" }, 502);
    }

    const emailData = await emailResponse.json().catch(() => ({}));

    // A draft becomes "sent" by being mailed. Compare-and-set: any other status stays exactly what it is.
    if (decision.markSent) {
      await db.from("invoices").update({ status: "sent" }).eq("id", invoice.id).eq("status", "draft");
    }

    return json({ success: true, messageId: emailData?.id ?? null });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return json({ error: "Something went wrong" }, 500);
  }
});
