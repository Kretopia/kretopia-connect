import { InvoiceBranding } from "./InvoiceBrandingForm";
import { PaymentConfig } from "./InvoicePaymentForm";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoicePreviewProps {
  branding: InvoiceBranding;
  recipient: { name: string; email: string; address: string };
  invoiceNumber: string;
  dueDate: string;
  lineItems: LineItem[];
  taxRate: number;
  discount: { type: string; value: number; amount: number };
  notes: string;
  payment: PaymentConfig;
  currency?: string;
  documentType?: "invoice" | "quote";
  validUntil?: string;
}

export function InvoicePreview({
  branding, recipient, invoiceNumber, dueDate,
  lineItems, taxRate, discount, notes, payment, currency = "USD",
  documentType = "invoice", validUntil
}: InvoicePreviewProps) {
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const discountAmt = discount.type === "percentage" ? subtotal * (discount.value / 100) : discount.amount;
  const afterDiscount = subtotal - discountAmt;
  const tax = afterDiscount * (taxRate / 100);
  const total = afterDiscount + tax;
  const brandColor = branding.brand_color || "#6366f1";
  const isQuote = documentType === "quote";
  const docTitle = isQuote ? "Quote" : "Invoice";

  const fmt = (n: number) => {
    const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", NGN: "₦", KES: "KSh ", BRL: "R$", ZAR: "R", AED: "د.إ ", IDR: "Rp ", TTD: "TT$", CHF: "CHF ", CAD: "C$", AUD: "A$" };
    const sym = symbols[currency] || `${currency} `;
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const issueDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dueDateFormatted = dueDate
    ? new Date(dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <Card className="p-0 overflow-hidden shadow-xl border-0 bg-white dark:bg-zinc-950">
      {/* Letterhead or premium accent */}
      {branding.letterhead_url ? (
        <img src={branding.letterhead_url} alt="Letterhead" className="w-full h-auto object-cover" />
      ) : (
        <div className="relative">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${brandColor}, ${brandColor}88)` }} />
          {/* Subtle corner accent */}
          <div
            className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]"
            style={{
              background: `radial-gradient(circle at top right, ${brandColor}, transparent 70%)`,
            }}
          />
        </div>
      )}

      <div className="p-5 sm:p-8 space-y-6">
        {/* Header */}
        {!branding.letterhead_url && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {branding.brand_logo_url && (
                <img src={branding.brand_logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-contain flex-shrink-0 shadow-sm" />
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-lg tracking-tight truncate">{branding.brand_name || "Your Business"}</h2>
                {branding.brand_address && <p className="text-[11px] text-muted-foreground leading-snug">{branding.brand_address}</p>}
                {branding.brand_email && <p className="text-[11px] text-muted-foreground">{branding.brand_email}</p>}
                {branding.brand_website && <p className="text-[11px] text-muted-foreground">{branding.brand_website}</p>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <h1
                className="text-2xl sm:text-3xl font-black tracking-tighter uppercase"
                style={{ color: brandColor }}
              >
                {docTitle}
              </h1>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{invoiceNumber || `${isQuote ? "QUO" : "INV"}-DRAFT`}</p>
            </div>
          </div>
        )}

        {branding.letterhead_url && (
          <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase" style={{ color: brandColor }}>{docTitle}</h1>
            <p className="text-xs font-mono text-muted-foreground">{invoiceNumber || `${isQuote ? "QUO" : "INV"}-DRAFT`}</p>
            </div>
          </div>
        )}

        {/* Date + Bill To Row */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">{isQuote ? "Quote For" : "Bill To"}</p>
            <p className="font-semibold text-sm">{recipient.name || "Client Name"}</p>
            {recipient.email && <p className="text-xs text-muted-foreground mt-0.5">{recipient.email}</p>}
            {recipient.address && <p className="text-xs text-muted-foreground">{recipient.address}</p>}
          </div>
          <div className="text-right">
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-0.5">Issue Date</p>
              <p className="text-xs font-medium">{issueDate}</p>
            </div>
            {dueDateFormatted && !isQuote && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-0.5">Due Date</p>
                <p className="text-xs font-medium">{dueDateFormatted}</p>
              </div>
            )}
            {isQuote && validUntil && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-0.5">Valid Until</p>
                <p className="text-xs font-medium">{new Date(validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table - Premium styling */}
        <div className="rounded-xl overflow-hidden border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: brandColor + "0D" }}>
                <th className="text-left p-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="text-center p-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-14">Qty</th>
                <th className="text-right p-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-24">Rate</th>
                <th className="text-right p-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="p-3 text-xs font-medium">{item.description || "—"}</td>
                  <td className="p-3 text-xs text-center text-muted-foreground">{item.quantity}</td>
                  <td className="p-3 text-xs text-right text-muted-foreground">{fmt(item.rate)}</td>
                  <td className="p-3 text-xs text-right font-semibold">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals - Premium card style */}
        <div className="flex justify-end">
          <div className="w-72 rounded-xl p-4 space-y-2" style={{ backgroundColor: brandColor + "08" }}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{fmt(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-green-600 dark:text-green-400">
                  Discount {discount.type === "percentage" ? `(${discount.value}%)` : ""}
                </span>
                <span className="text-green-600 dark:text-green-400 font-medium">-{fmt(discountAmt)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="font-medium">{fmt(tax)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold">{isQuote ? "Total" : "Total Due"}</span>
              <span className="text-xl font-black tracking-tight" style={{ color: brandColor }}>
                {fmt(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Info - Premium card */}
        {payment.payment_method && (
          <div className="rounded-xl border border-border/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ backgroundColor: brandColor + "15", color: brandColor }}>
                💳
              </div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Payment Details</p>
            </div>
            {payment.payment_method === "thrivepay" && (
              <p className="text-xs font-medium" style={{ color: brandColor }}>
                Pay securely via KrePay — a payment link will be included in the email
              </p>
            )}
            {payment.payment_method === "bank_transfer" && (
              <div className="text-xs space-y-1 text-muted-foreground">
                {payment.payment_details.bank_name && <p><span className="font-medium text-foreground">Bank:</span> {payment.payment_details.bank_name}</p>}
                {payment.payment_details.account_name && <p><span className="font-medium text-foreground">Account:</span> {payment.payment_details.account_name}</p>}
                {payment.payment_details.account_number && <p><span className="font-medium text-foreground">Number:</span> {payment.payment_details.account_number}</p>}
                {payment.payment_details.routing_number && <p><span className="font-medium text-foreground">Routing/SWIFT:</span> {payment.payment_details.routing_number}</p>}
              </div>
            )}
            {payment.payment_method === "paypal" && (
              <p className="text-xs"><span className="font-medium">PayPal:</span> {payment.payment_details.paypal_email}</p>
            )}
            {payment.payment_method === "other" && (
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">{payment.payment_details.instructions}</p>
            )}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">Notes</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Terms */}
        {payment.terms_conditions && (
          <div className="pt-3 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">Terms & Conditions</p>
            <p className="text-[10px] text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">{payment.terms_conditions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/60 tracking-wide">
            Thank you for your business
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-1">
            Generated with Kretopia • kretopia.com
          </p>
        </div>
      </div>
    </Card>
  );
}
