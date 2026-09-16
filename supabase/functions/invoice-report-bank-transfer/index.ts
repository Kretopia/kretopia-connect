// Sandbox manual-SEPA extension. Guest-callable (no auth) -- the payer may
// have no Kretopia account at all, same rationale already documented for
// confirm_invoice_paid_manually's self-report design. Possession of the
// unguessable invoice UUID is the access boundary, matching invoice-pay-info.
//
// This endpoint does exactly one thing: stamps bank_transfer_reported_at.
// It never sets status = 'paid' and never touches any wallet/ledger table.
// The invoice remains in its existing status until the issuer runs
// confirm_invoice_paid_manually themselves -- this is a "the payer says they
// sent it" signal, not a payment confirmation.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { id } = await req.json();
    if (!id || typeof id !== "string") throw new Error("id required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice, error: fetchErr } = await admin
      .from("invoices")
      .select("id, status, bank_transfer_reported_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.status === "paid") {
      // Already paid — nothing to report. Idempotent, not an error.
      return new Response(JSON.stringify({ success: true, status: "paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.bank_transfer_reported_at) {
      // Already reported — idempotent no-op, don't overwrite the original
      // timestamp (useful signal for support if a payer reports twice).
      return new Response(
        JSON.stringify({ success: true, status: "payment_reported", reportedAt: invoice.bank_transfer_reported_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportedAt = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("invoices")
      .update({ bank_transfer_reported_at: reportedAt })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, status: "payment_reported", reportedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
