import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";

interface PayLinkData {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  mode: "fixed" | "open" | "suggested";
  amount_cents: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  currency: string;
}
interface Recipient { full_name?: string | null; username?: string | null; avatar_url?: string | null; }

const fmt = (cents: number, cur: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);

export default function PayLink() {
  const { slug } = useParams<{ slug: string }>();
  const [sp] = useSearchParams();
  const status = sp.get("status");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<PayLinkData | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("payment-link-info", {
          body: null,
        });
        // invoke doesn't pass query — call directly
        const res = await fetch(
          `https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/payment-link-info?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Link not available");
        setLink(json.link);
        setRecipient(json.recipient);
        if (json.link?.mode === "suggested" && json.link.amount_cents) {
          setAmountInput((json.link.amount_cents / 100).toFixed(2));
        }
      } catch (e: any) {
        setError(e?.message || "Couldn't load this link");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [slug]);

  const handlePay = async () => {
    if (!link) return;
    setSubmitting(true);
    try {
      let amount_cents: number | undefined;
      if (link.mode !== "fixed") {
        const n = Number(amountInput);
        if (!n || n <= 0) throw new Error("Enter an amount");
        amount_cents = Math.round(n * 100);
      }
      const { data, error } = await supabase.functions.invoke("create-payment-link-checkout", {
        body: {
          slug: link.slug,
          amount_cents,
          payer_email: email || undefined,
          payer_name: name || undefined,
          payer_note: note || undefined,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout unavailable");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Couldn't start checkout");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <SEO title="Payment received" description="Thanks for your payment" />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-[hsl(var(--energy-lime))] mx-auto" />
            <h1 className="text-2xl font-serif">Payment received</h1>
            <p className="text-muted-foreground">Thanks — {recipient?.full_name || "the recipient"} will be notified.</p>
            <Button asChild className="w-full"><Link to="/">Back to Kretopia</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !link) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">{error}</h1>
        </CardContent></Card>
      </div>
    );
  }
  if (!link) return null;

  const displayAmount = link.mode === "fixed" && link.amount_cents
    ? fmt(link.amount_cents, link.currency)
    : null;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 flex items-center justify-center">
      <SEO title={`Pay ${recipient?.full_name || link.title}`} description={link.description || `Pay ${link.title}`} />
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            {recipient?.avatar_url && (
              <img src={recipient.avatar_url} alt="" className="h-16 w-16 rounded-full mx-auto object-cover" />
            )}
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paying</p>
            <p className="font-semibold">{recipient?.full_name || "Kretopia creator"}</p>
            <h1 className="text-2xl font-serif">{link.title}</h1>
            {link.description && <p className="text-sm text-muted-foreground">{link.description}</p>}
          </div>

          {displayAmount ? (
            <div className="text-center py-4 border-y">
              <p className="text-4xl font-bold">{displayAmount}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({link.currency})</Label>
              <Input
                id="amount"
                type="number"
                min={(link.min_amount_cents ?? 100) / 100}
                step="0.01"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="text-2xl h-14 text-center"
              />
              {link.mode === "suggested" && (
                <p className="text-xs text-muted-foreground text-center">Suggested — feel free to change it</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label htmlFor="email">Your email (for the receipt)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="name">Your name (optional)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What's this for?" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button onClick={handlePay} disabled={submitting} className="w-full h-12 text-base">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Pay securely
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Powered by KrePay · Card, Apple Pay, Google Pay
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
