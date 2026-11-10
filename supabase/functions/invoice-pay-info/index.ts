// Public read of a payable invoice. Used by /pay/invoice/:id
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";


import { corsFor, safeError } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await publicPerimeter(req, "invoice-pay-info", 30);
    } catch (perimeterError) {
      return safeError(perimeterError, req);
    }
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("id");
    if (!invoiceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, invoice_number, issued_by, recipient_name, total_amount, currency, status, due_date, notes, brand_name, brand_logo_url, brand_color, document_type, line_items, bank_transfer_reported_at")
      .eq("id", invoiceId)
      .maybeSingle();
    // Only invoices actually sent to a client are readable here; drafts and
    // cancelled documents are indistinguishable from a missing id.
    if (!invoice || ["draft", "cancelled", "void"].includes(String(invoice.status))) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invoice.document_type === "quote") {
      return new Response(JSON.stringify({ error: "Quotes can't be paid online" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark viewed (best effort)
    if (invoice.status === "sent") {
      await admin.from("invoices").update({ viewed_at: new Date().toISOString() }).eq("id", invoiceId);
    }

    // Sandbox manual-SEPA extension: surface the issuer's own beneficiary
    // details (if they've configured any via set_invoice_sepa_beneficiary)
    // plus a stable, human-typable payment reference derived from the
    // invoice's own id/number -- no new column needed for the reference
    // itself. Money never routes through Kretopia for this path: the client
    // sends the transfer directly to the issuer's own account.
    let sepa: { beneficiaryName: string; iban: string; bic: string | null; reference: string } | null = null;
    if (invoice.issued_by && invoice.status !== "paid") {
      const { data: beneficiary } = await admin
        .from("invoice_sepa_beneficiaries")
        .select("beneficiary_name, iban, bic")
        .eq("user_id", invoice.issued_by)
        .maybeSingle();
      if (beneficiary) {
        sepa = {
          beneficiaryName: beneficiary.beneficiary_name,
          iban: beneficiary.iban,
          bic: beneficiary.bic,
          reference: `KP-${(invoice.invoice_number ?? invoice.id.slice(0, 8)).toString().toUpperCase()}`,
        };
      }
    }

    return new Response(JSON.stringify({ invoice: { ...invoice, sepa } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[invoice-pay-info]", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
