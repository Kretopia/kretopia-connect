import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Beneficiary {
  beneficiary_name: string;
  iban: string;
  bic: string | null;
}

/**
 * Sandbox manual-SEPA extension — lets a creator add their own bank details
 * so their invoice payment page can offer "Pay by bank transfer" alongside
 * card. Money never routes through Kretopia here: a client who chooses this
 * option sends a SEPA credit transfer straight to the IBAN below, from their
 * own bank. Distinct from the Stripe Connect payout setup above — that's
 * how Kretopia pays *you* from your wallet; this is how a *client* can pay
 * *you* directly for one invoice.
 */
export function InvoiceSepaBeneficiaryCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Beneficiary | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("invoice_sepa_beneficiaries")
      .select("beneficiary_name, iban, bic")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setName(data.beneficiary_name);
          setIban(data.iban);
          setBic(data.bic || "");
        }
        setLoading(false);
      });
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_invoice_sepa_beneficiary", {
        p_beneficiary_name: name,
        p_iban: iban,
        p_bic: bic || null,
      });
      if (error) throw error;
      setExisting({ beneficiary_name: name.trim(), iban: iban.replace(/\s/g, "").toUpperCase(), bic: bic.trim() || null });
      setEditing(false);
      toast({ title: "Bank transfer details saved", description: "Your future invoice payment pages can now offer bank transfer." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message || "Check the IBAN and try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-border/60 shadow-none">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-5 w-5 text-primary" />
          Bank transfer for invoices
        </CardTitle>
        <CardDescription>
          EUR/SEPA only. When set, clients can pay your invoices by sending a bank transfer directly
          to this account — Kretopia never holds or moves that money.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {existing && !editing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--energy-lime))] font-medium">
              <CheckCircle2 className="h-4 w-4" /> Bank transfer is available on your invoices
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Beneficiary:</span> {existing.beneficiary_name}</p>
              <p className="font-mono"><span className="text-muted-foreground font-sans">IBAN:</span> {existing.iban}</p>
              {existing.bic && <p className="font-mono"><span className="text-muted-foreground font-sans">BIC:</span> {existing.bic}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit details</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sepa-name">Beneficiary name</Label>
              <Input id="sepa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="As it appears on your bank account" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sepa-iban">IBAN</Label>
              <Input id="sepa-iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sepa-bic">BIC / SWIFT (optional)</Label>
              <Input id="sepa-bic" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="COBADEFFXXX" className="font-mono" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !name.trim() || !iban.trim()} size="sm">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save
              </Button>
              {existing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InvoiceSepaBeneficiaryCard;
