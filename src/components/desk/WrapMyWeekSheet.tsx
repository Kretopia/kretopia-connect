import { useEffect, useState } from "react";
import { Loader2, Mail, FileText, Sparkles, Copy, Check, RefreshCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface WrapMyWeekSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Limit recap to a single project. Omit for "all my projects this week". */
  projectId?: string;
}

interface RecapResponse {
  email: { subject: string; body: string; recipient_suggestion: string | null };
  invoice: {
    line_items: Array<{ description: string; quantity: number; unit_price: number }>;
    total_suggestion: number;
    currency: string;
  };
  highlights: string[];
}

/**
 * "Wrap my week" — voice-first weekly client recap.
 *
 * Aggregates the user's last 7 days of completed tasks, files delivered,
 * notes, and messages, then asks Gemini to draft a warm client update
 * email + an invoice line-item suggestion. The user can edit, copy, or
 * push the invoice draft into KrePay.
 *
 * This is THE differentiating feature — no other PM tool turns a week of
 * work into a ready-to-send client email + invoice in one tap.
 */
export const WrapMyWeekSheet = ({ open, onOpenChange, projectId }: WrapMyWeekSheetProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecapResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);

  const generate = async () => {
    setLoading(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("weekly-recap", {
        body: { projectId, days: 7 },
      });
      if (error) throw error;
      setData(res as RecapResponse);
      setSubject(res?.email?.subject ?? "");
      setBodyText(res?.email?.body ?? "");
      setRecipient(res?.email?.recipient_suggestion ?? "");
    } catch (err: any) {
      toast({
        title: "Couldn't wrap the week",
        description: err.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run when opened
  useEffect(() => {
    if (open && !data && !loading) {
      void generate();
    }
    if (!open) {
      setData(null);
      setSubject("");
      setBodyText("");
      setRecipient("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async (text: string, key: "subject" | "body" | "all") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const sendByEmail = () => {
    const to = recipient.trim();
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = url;
  };

  const goCreateInvoice = () => {
    if (!data?.invoice?.line_items?.length) {
      toast({ title: "Nothing billable to invoice this week" });
      return;
    }
    // Stash a draft in sessionStorage that KrePay can pick up
    try {
      sessionStorage.setItem(
        "thrivepay:invoice-draft",
        JSON.stringify({
          ...data.invoice,
          source: "weekly-recap",
          project_id: projectId ?? null,
          recipient_email: recipient,
        })
      );
    } catch {
      // ignore quota
    }
    onOpenChange(false);
    navigate("/thrivepay?tab=invoices&prefill=recap");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] sm:h-[88vh] sm:max-w-2xl sm:mx-auto sm:rounded-t-3xl overflow-y-auto"
      >
        <SheetHeader className="text-left mb-3">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Wrap my week
          </SheetTitle>
          <SheetDescription>
            One tap. We'll write the client update and a draft invoice from your last 7 days of work.
          </SheetDescription>
        </SheetHeader>

        {loading && !data && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Reading the week's tasks, files, and notes…
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Highlights */}
            {data.highlights?.length > 0 && (
              <Card className="p-3 space-y-2 bg-muted/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  This week, in 5 lines
                </p>
                <ul className="space-y-1">
                  {data.highlights.map((h, i) => (
                    <li key={i} className="text-sm leading-snug flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Client email */}
            <section className="space-y-2">
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" /> Client update
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => copy(`${subject}\n\n${bodyText}`, "all")}
                >
                  {copied === "all" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy all
                </Button>
              </header>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    To
                  </label>
                  <Input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="client@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Body
                  </label>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={10}
                    className="mt-1 text-sm leading-relaxed"
                  />
                </div>
              </div>
            </section>

            {/* Invoice draft */}
            {data.invoice?.line_items?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" /> Invoice draft
                </h3>
                <Card className="p-3 divide-y divide-border">
                  {data.invoice.line_items.map((li, i) => (
                    <div key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex-1 pr-3">
                        {li.description}{" "}
                        {li.quantity > 1 && (
                          <span className="text-muted-foreground">× {li.quantity}</span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {data.invoice.currency} {Number(li.unit_price * (li.quantity || 1)).toFixed(0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 text-sm">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-primary tabular-nums">
                      {data.invoice.currency} {Number(data.invoice.total_suggestion).toFixed(0)}
                    </span>
                  </div>
                </Card>
              </section>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 sticky bottom-0 bg-background pb-2">
              <Button variant="outline" onClick={generate} className="gap-1.5">
                <RefreshCcw className="h-4 w-4" /> Redo
              </Button>
              <Button onClick={sendByEmail} className="gap-1.5">
                <Mail className="h-4 w-4" /> Send email
              </Button>
              {data.invoice?.line_items?.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={goCreateInvoice}
                  className="col-span-2 gap-1.5"
                >
                  <FileText className="h-4 w-4" /> Open invoice in KrePay
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
