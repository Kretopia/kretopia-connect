import { DollarSign, Sparkles, CheckCircle, Receipt } from "lucide-react";

/**
 * Pay — invoices, quotes, receipts. Show the chat that drafts/edits invoices
 * for you (the killer feature) + a real invoice card.
 */
export const ProductSectionPay = () => (
  <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
    <div className="container mx-auto max-w-6xl">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        {/* Copy */}
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            <Receipt className="h-3 w-3" /> KrePay · Get paid
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-foreground mb-4">
            Quote, invoice, paid —<br />
            <span className="text-energy-glow">in one chat.</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 max-w-md">
            Tell Thrive what the job is. It pulls your project context, drafts the line items, suggests rates from your past invoices, and sends a pro-grade quote your client can pay in one tap.
          </p>
          <ul className="space-y-2 mb-6">
            {[
              "Auto-drafts line items from your project brief",
              "Remembers your rates, vendors & client history",
              "Stripe + bank transfer · USD, TTD, EUR & more",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle className="h-4 w-4 text-energy mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mock — invoice + chat side by side */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-energy/15 to-primary/10 blur-3xl" />
          <div className="grid grid-cols-2 gap-3">
            {/* Invoice card */}
            <div className="rounded-2xl border border-primary/30 bg-card shadow-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Invoice #1042</p>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-energy/15 text-energy">Draft</span>
              </div>
              <p className="text-[10px] text-muted-foreground">To · Aurora Studios</p>
              <p className="text-3xl font-black text-foreground tracking-tight leading-none mt-1.5">$3,910</p>
              <p className="text-[9px] text-muted-foreground font-bold mt-0.5">USD · Due Mar 28</p>
              <div className="mt-3 space-y-1 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                <div className="flex justify-between"><span>DP day rate × 3</span><span className="text-foreground font-medium">$2,400</span></div>
                <div className="flex justify-between"><span>Pre-prod / scouting</span><span className="text-foreground font-medium">$600</span></div>
                <div className="flex justify-between"><span>Color delivery</span><span className="text-foreground font-medium">$400</span></div>
                <div className="flex justify-between text-energy"><span className="font-bold">+ Rush fee 15%</span><span className="font-bold">$510</span></div>
              </div>
              <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-energy" />
                <p className="text-[10px] font-black text-energy">Pay link ready</p>
              </div>
            </div>

            {/* Chat with Thrive */}
            <div className="rounded-2xl border border-energy/40 bg-card shadow-xl p-3.5 flex flex-col">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="h-3.5 w-3.5 text-energy" />
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground">Chat · Thrive</p>
              </div>
              <div className="space-y-2 flex-1">
                <div className="rounded-xl bg-muted/40 px-2.5 py-1.5 max-w-[90%]">
                  <p className="text-[10px] text-foreground leading-snug">Draft the invoice from the SS26 brief.</p>
                </div>
                <div className="rounded-xl bg-primary/15 border border-primary/30 px-2.5 py-1.5 max-w-[95%]">
                  <p className="text-[10px] text-foreground leading-snug">Done — 3 line items, USD, your usual rate. Want me to add anything?</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-2.5 py-1.5 max-w-[90%]">
                  <p className="text-[10px] text-foreground leading-snug">Add a 15% rush fee, turnaround is 5 days.</p>
                </div>
                <div className="rounded-xl bg-energy/15 border border-energy/30 px-2.5 py-1.5 max-w-[95%]">
                  <p className="text-[10px] text-foreground leading-snug font-medium">Added <strong>$510</strong>. Updated total <strong>$3,910</strong>. Send now?</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
                <p className="text-[9px] font-black uppercase tracking-wider text-energy">Memory on · remembers every chat</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
