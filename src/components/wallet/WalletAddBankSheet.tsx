import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Landmark, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded?: () => void;
}

// Mirrors the Edge Function's error-code vocabulary — never show the raw
// Stripe/DB message to the user, only these reviewed, actionable strings.
const ERROR_COPY: Record<string, string> = {
  authentication_required: "Sign in again, then try adding your bank account.",
  wallet_not_found: "We couldn't find your payout wallet. Try again or contact support.",
  connect_account_missing: "Your payout account couldn't be found. Contact support.",
  connect_account_mismatch: "Your payout account is already set up for a different country. Contact support to reset it.",
  country_not_supported: "That country isn't supported for payouts yet.",
  currency_not_supported: "That currency doesn't match the selected country.",
  invalid_iban: "That IBAN doesn't look right — please double-check it.",
  invalid_bank_details: "Those bank details were rejected — please double-check them.",
  account_requirement_missing: "Your bank details were valid, but your payout account still needs verification. Complete the remaining account requirements, then try again.",
  account_not_ready: "Your payout account isn't ready yet. Complete the remaining requirements, then try again.",
  bank_account_already_exists: "This bank account is already on file.",
  stripe_configuration_error: "Payments aren't configured correctly right now. Contact support.",
  stripe_api_error: "Your bank couldn't be added right now. Try again in a moment.",
  database_persistence_error: "Your bank details were valid, but we couldn't save them. Try again.",
  unknown_error: "Something went wrong adding your bank account. Try again.",
};

interface AddBankResponse {
  ok?: boolean;
  error?: string;
  code?: string;
  requirements_due?: string[];
}

async function describeAddBankError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (body?.code && ERROR_COPY[body.code]) return ERROR_COPY[body.code];
      if (typeof body?.error === "string") return body.error;
    } catch {
      // fall through to generic message below
    }
  }
  return ERROR_COPY.unknown_error;
}

const COUNTRIES = [
  { code: "US", currency: "USD", routingLabel: "Routing number (ABA)", routingRequired: true, accountLabel: "Account number" },
  { code: "CA", currency: "CAD", routingLabel: "Transit + Institution (XXXXX-YYY)", routingRequired: true, accountLabel: "Account number" },
  { code: "GB", currency: "GBP", routingLabel: "Sort code (XX-XX-XX)", routingRequired: true, accountLabel: "Account number" },
  { code: "AU", currency: "AUD", routingLabel: "BSB", routingRequired: true, accountLabel: "Account number" },
  { code: "DE", currency: "EUR", routingLabel: "", routingRequired: false, accountLabel: "IBAN" },
  { code: "FR", currency: "EUR", routingLabel: "", routingRequired: false, accountLabel: "IBAN" },
  { code: "NL", currency: "EUR", routingLabel: "", routingRequired: false, accountLabel: "IBAN" },
  { code: "ES", currency: "EUR", routingLabel: "", routingRequired: false, accountLabel: "IBAN" },
];

export function WalletAddBankSheet({ open, onOpenChange, onAdded }: Props) {
  const { toast } = useToast();
  const [country, setCountry] = useState("US");
  const [holder, setHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routing, setRouting] = useState("");
  const [loading, setLoading] = useState(false);
  const cfg = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];

  useEffect(() => {
    setRouting("");
    setAccountNumber("");
  }, [country]);

  const submit = async () => {
    if (!holder || !accountNumber || (cfg.routingRequired && !routing)) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AddBankResponse>("wallet-add-bank", {
        body: {
          country,
          currency: cfg.currency,
          account_holder_name: holder,
          account_number: accountNumber.replace(/\s+/g, ""),
          routing_number: cfg.routingRequired ? routing.replace(/[-\s]+/g, "") : undefined,
          make_default: true,
        },
      });
      if (error) {
        toast({ title: "Couldn't add bank", description: await describeAddBankError(error), variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({
          title: "Couldn't add bank",
          description: (data.code && ERROR_COPY[data.code]) ?? data.error,
          variant: "destructive",
        });
        return;
      }
      const requirementsDue = data?.requirements_due ?? [];
      toast(
        requirementsDue.length > 0
          ? { title: "Bank added", description: ERROR_COPY.account_requirement_missing }
          : { title: "Bank added", description: "You can now get paid." },
      );
      onAdded?.();
      onOpenChange(false);
      setHolder(""); setAccountNumber(""); setRouting("");
    } catch {
      toast({ title: "Couldn't add bank", description: ERROR_COPY.unknown_error, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" /> Add your bank
          </SheetTitle>
          <SheetDescription>Get paid directly into your account. No third-party signup.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} · {c.currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Account holder name</Label>
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Full name on the account" />
          </div>

          {cfg.routingRequired && (
            <div className="space-y-2">
              <Label>{cfg.routingLabel}</Label>
              <Input value={routing} onChange={(e) => setRouting(e.target.value)} inputMode="numeric" />
            </div>
          )}

          <div className="space-y-2">
            <Label>{cfg.accountLabel}</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" />
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>Bank details are encrypted and processed by our payment partner. Kretopia never stores your full account number.</p>
          </div>

          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving</> : "Save bank account"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
