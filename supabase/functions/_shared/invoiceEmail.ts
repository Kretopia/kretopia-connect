// Pure rules and rendering for the invoice email (a payment link sent from our own sender address).
// Imported by the edge function (Deno) and by tests (Vite). No network, no env.
//
// Why: send-invoice-email interpolated every invoice field and the recipient straight into branded HTML, so any signed-in
// issuer could put their own markup and links in a mail that carries our address and a "Pay" button; it accepted any
// recipient string, had no volume limit, and set the invoice to "sent" whatever its status was (a paid or cancelled
// invoice became payable again). Everything here is decided before the provider is called.

import { escapeHtmlText, singleLine } from "./outboundText.ts";

export const INVOICE_EMAIL_TEMPLATE = "invoice-direct";
export const INVOICE_EMAILS_PER_ACTOR_PER_HOUR = 30;
export const INVOICE_EMAILS_PER_RECIPIENT_PER_HOUR = 5;

/** An invoice that is settled or withdrawn is not mailed again with a payment button. */
export const SENDABLE_STATUSES: readonly string[] = ["draft", "sent", "overdue", "accepted"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type InvoiceSendDecision =
  | { ok: true; markSent: boolean }
  | { ok: false; status: 404 | 409; error: string; reason: "not_found" | "not_sendable" };

/** Who may send what: only the issuer, and only an invoice that is still open. A stranger gets the answer a missing invoice gets. */
export function decideInvoiceSend(
  invoice: { issued_by?: unknown; status?: unknown } | null | undefined,
  actorId: string,
): InvoiceSendDecision {
  if (!invoice || invoice.issued_by !== actorId) return { ok: false, status: 404, error: "Invoice not found", reason: "not_found" };
  const status = typeof invoice.status === "string" ? invoice.status : "";
  if (!SENDABLE_STATUSES.includes(status)) {
    return { ok: false, status: 409, error: `This invoice is ${status || "not open"} and cannot be sent`, reason: "not_sendable" };
  }
  // Only a draft becomes "sent" by being mailed; every other status stays what it is.
  return { ok: true, markSent: status === "draft" };
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : 0);

export function formatMoney(amount: unknown, currency: unknown): string {
  const code = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD";
  const value = num(amount).toFixed(2);
  return code === "USD" ? `$${value}` : `${code} ${value}`;
}

const MAX_LINE_ITEMS = 100;

export interface InvoiceForEmail {
  id: string;
  invoice_number?: unknown;
  brand_name?: unknown;
  brand_email?: unknown;
  recipient_name?: unknown;
  due_date?: unknown;
  status?: unknown;
  line_items?: unknown;
  amount?: unknown;
  tax_rate?: unknown;
  tax_amount?: unknown;
  total_amount?: unknown;
  currency?: unknown;
  notes?: unknown;
}

const esc = (v: unknown, max: number) => escapeHtmlText(singleLine(v, max));

/** Subject and HTML for one invoice. Every value that did not come from this file is escaped; the pay link is built from a validated id. */
export function renderInvoiceEmail(invoice: InvoiceForEmail, recipientEmail: string, payToken = ""): { subject: string; html: string } {
  const number = esc(invoice.invoice_number, 60);
  const currency = invoice.currency;
  const items = (Array.isArray(invoice.line_items) ? invoice.line_items : []).slice(0, MAX_LINE_ITEMS);
  const rows = items
    .map((raw) => {
      const item = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${esc(item.description, 300)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${esc(num(item.quantity), 20)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtmlText(formatMoney(item.rate, currency))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtmlText(formatMoney(item.amount, currency))}</td>
        </tr>`;
    })
    .join("");

  const due = invoice.due_date ? new Date(String(invoice.due_date)) : null;
  const dueLine = due && !Number.isNaN(due.getTime())
    ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${escapeHtmlText(due.toISOString().slice(0, 10))}</p>`
    : "";
  const status = esc(invoice.status, 20);
  const taxBlock = num(invoice.tax_rate) > 0
    ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span>Tax (${escapeHtmlText(String(num(invoice.tax_rate)))}%):</span>
                <span>${escapeHtmlText(formatMoney(invoice.tax_amount, currency))}</span>
              </div>`
    : "";
  const notesBlock = typeof invoice.notes === "string" && invoice.notes.trim()
    ? `
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 10px 0; color: #111827;">Notes</h3>
              <p style="margin: 0; color: #6b7280; white-space: pre-wrap;">${escapeHtmlText(invoice.notes.slice(0, 2000))}</p>
            </div>`
    : "";
  const total = formatMoney(invoice.total_amount, currency);
  const payBlock = invoice.status !== "paid" && isUuid(invoice.id)
    ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.kretopia.com/pay/invoice/${invoice.id}?t=${encodeURIComponent(payToken)}"
                 style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Pay ${escapeHtmlText(total)} securely
              </a>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">Card, Apple Pay, Google Pay · Powered by ThrivePay</p>
            </div>`
    : "";

  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${number}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
            <h1 style="margin: 0 0 10px 0; font-size: 32px; color: #111827;">Invoice</h1>
            <p style="margin: 0; color: #6b7280; font-size: 18px;">#${number}</p>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <h3 style="margin: 0 0 10px 0; color: #111827;">From</h3>
              <p style="margin: 0; color: #6b7280;">${esc(invoice.brand_name, 120) || "N/A"}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${esc(invoice.brand_email, 254)}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0 0 10px 0; color: #111827;">To</h3>
              <p style="margin: 0; color: #6b7280;">${esc(invoice.recipient_name, 120) || "N/A"}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${escapeHtmlText(recipientEmail)}</p>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            ${dueLine}
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="text-transform: capitalize; padding: 4px 8px; background-color: #dbeafe; color: #1e40af; border-radius: 4px;">${status}</span></p>
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
            <tbody>${rows}
            </tbody>
          </table>

          <div style="margin-left: auto; width: 300px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Subtotal:</span>
              <span>${escapeHtmlText(formatMoney(invoice.amount, currency))}</span>
            </div>${taxBlock}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 20px; font-weight: bold; border-top: 2px solid #e5e7eb;">
              <span>Total:</span>
              <span>${escapeHtmlText(total)}</span>
            </div>
          </div>
${notesBlock}${payBlock}
          <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;

  const brand = singleLine(invoice.brand_name, 80) || "Kretopia";
  return { subject: singleLine(`Invoice ${singleLine(invoice.invoice_number, 60)} from ${brand}`, 150), html };
}
