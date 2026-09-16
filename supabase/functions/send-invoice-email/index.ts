import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvoiceEmailRequest {
  invoiceId: string;
  recipientEmail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { invoiceId, recipientEmail }: InvoiceEmailRequest = await req.json();

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError) throw invoiceError;

    // Verify user has access to this invoice
    if (invoice.issued_by !== user.id) {
      throw new Error("Unauthorized to send this invoice");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const lineItemsHtml = (invoice.line_items as any[])
      .map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.rate.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.amount.toFixed(2)}</td>
        </tr>
      `)
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${invoice.invoice_number}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
            <h1 style="margin: 0 0 10px 0; font-size: 32px; color: #111827;">Invoice</h1>
            <p style="margin: 0; color: #6b7280; font-size: 18px;">#${invoice.invoice_number}</p>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <h3 style="margin: 0 0 10px 0; color: #111827;">From</h3>
              <p style="margin: 0; color: #6b7280;">${invoice.brand_name || 'N/A'}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${invoice.brand_email || ''}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0 0 10px 0; color: #111827;">To</h3>
              <p style="margin: 0; color: #6b7280;">${invoice.recipient_name || 'N/A'}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${recipientEmail}</p>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="text-transform: capitalize; padding: 4px 8px; background-color: #dbeafe; color: #1e40af; border-radius: 4px;">${invoice.status}</span></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
                <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Rate</th>
                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>

          <div style="margin-left: auto; width: 300px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Subtotal:</span>
              <span>$${invoice.amount.toFixed(2)}</span>
            </div>
            ${invoice.tax_rate ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span>Tax (${invoice.tax_rate}%):</span>
                <span>$${invoice.tax_amount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 20px; font-weight: bold; border-top: 2px solid #e5e7eb;">
              <span>Total:</span>
              <span>$${invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>

          ${invoice.notes ? `
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 10px 0; color: #111827;">Notes</h3>
              <p style="margin: 0; color: #6b7280; white-space: pre-wrap;">${invoice.notes}</p>
            </div>
          ` : ''}

          ${invoice.status !== 'paid' ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.kretopia.com/pay/invoice/${invoice.id}"
                 style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Pay $${Number(invoice.total_amount).toFixed(2)} securely
              </a>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">Card, Apple Pay, Google Pay · Powered by ThrivePay</p>
            </div>
          ` : ''}

          <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Kretopia <info@kretopia.com>",
        to: [recipientEmail],
        subject: `Invoice ${invoice.invoice_number} from ${invoice.brand_name || 'Kretopia'}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailData = await emailResponse.json();

    // Update invoice status to "sent"
    await supabaseClient
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
