// Public read of a payable invoice. Used by /pay/invoice/:id
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("id");
    if (!invoiceId) throw new Error("id required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, invoice_number, issued_by, recipient_name, total_amount, currency, status, due_date, notes, brand_name, brand_logo_url, brand_color, document_type, line_items, bank_transfer_reported_at")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) {
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
    if (invoice.issued_by) {
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
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
