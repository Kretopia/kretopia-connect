import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Building, Wallet, Globe, CheckCircle2,
  Save, Trash2, ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PaymentConfig {
  payment_method: string;
  payment_details: Record<string, string>;
  terms_conditions: string;
}

interface SavedBank {
  id: string;
  label: string | null;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_number: string | null;
  is_default: boolean;
}

interface InvoicePaymentFormProps {
  config: PaymentConfig;
  onChange: (config: PaymentConfig) => void;
}

const DEFAULT_TERMS = `Payment Terms:
• Payment is due within 30 days of the invoice date.
• Late payments may incur a fee of 1.5% per month.
• All work remains the property of the creator until payment is received in full.
• Revisions beyond the agreed scope will be billed additionally.`;

export function InvoicePaymentForm({ config, onChange }: InvoicePaymentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasKrePay, setHasKrePay] = useState(false);
  const [savedBanks, setSavedBanks] = useState<SavedBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkKrePay();
      loadSavedBanks();
    }
  }, [user?.id]);

  const checkKrePay = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("stripe_account_status")
      .eq("user_id", user.id)
      .single();
    setHasKrePay(data?.stripe_account_status === "active");
  };

  const loadSavedBanks = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("saved_bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    if (data) setSavedBanks(data);
  };

  const selectSavedBank = (bankId: string) => {
    const bank = savedBanks.find((b) => b.id === bankId);
    if (!bank) return;
    setSelectedBankId(bankId);
    onChange({
      ...config,
      payment_details: {
        bank_name: bank.bank_name,
        account_name: bank.account_name,
        account_number: bank.account_number,
        routing_number: bank.routing_number || "",
      },
    });
  };

  const saveCurrentBank = async () => {
    if (!user?.id) return;
    const { bank_name, account_name, account_number, routing_number } = config.payment_details;
    if (!bank_name || !account_name || !account_number) {
      toast({ title: "Fill in bank name, account name and number first", variant: "destructive" });
      return;
    }
    setSavingBank(true);
    const label = `${bank_name} ••${account_number.slice(-4)}`;
    const { error } = await supabase.from("saved_bank_accounts").insert({
      user_id: user.id,
      label,
      bank_name,
      account_name,
      account_number,
      routing_number: routing_number || null,
      is_default: savedBanks.length === 0,
    });
    setSavingBank(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bank account saved" });
      loadSavedBanks();
    }
  };

  const deleteSavedBank = async (id: string) => {
    await supabase.from("saved_bank_accounts").delete().eq("id", id);
    if (selectedBankId === id) setSelectedBankId("");
    toast({ title: "Bank account removed" });
    loadSavedBanks();
  };

  const updateDetail = (key: string, value: string) => {
    setSelectedBankId("");
    onChange({
      ...config,
      payment_details: { ...config.payment_details, [key]: value },
    });
  };

  const isCurrentBankAlreadySaved = savedBanks.some(
    (b) =>
      b.account_number === config.payment_details.account_number &&
      b.bank_name === config.payment_details.bank_name
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Payment Method</h3>
      </div>

      <RadioGroup
        value={config.payment_method}
        onValueChange={(v) => {
          setSelectedBankId("");
          onChange({ ...config, payment_method: v, payment_details: {} });
        }}
        className="grid grid-cols-2 gap-2"
      >
        {/* KrePay */}
        <Label
          htmlFor="pay-thrivepay"
          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            config.payment_method === "thrivepay" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
          } ${!hasKrePay ? "opacity-50" : ""}`}
        >
          <RadioGroupItem value="thrivepay" id="pay-thrivepay" disabled={!hasKrePay} />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">KrePay</span>
              {hasKrePay && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {hasKrePay ? "Instant secure payments" : "Set up in KrePay"}
            </p>
          </div>
        </Label>

        {/* Bank Transfer */}
        <Label
          htmlFor="pay-bank"
          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            config.payment_method === "bank_transfer" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
          }`}
        >
          <RadioGroupItem value="bank_transfer" id="pay-bank" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Bank Transfer</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Wire / ACH / SWIFT</p>
          </div>
        </Label>

        {/* PayPal */}
        <Label
          htmlFor="pay-paypal"
          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            config.payment_method === "paypal" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
          }`}
        >
          <RadioGroupItem value="paypal" id="pay-paypal" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">PayPal</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Email-based payment</p>
          </div>
        </Label>

        {/* Other */}
        <Label
          htmlFor="pay-other"
          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            config.payment_method === "other" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
          }`}
        >
          <RadioGroupItem value="other" id="pay-other" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Other</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Custom instructions</p>
          </div>
        </Label>
      </RadioGroup>

      {/* Bank Transfer with saved accounts */}
      {config.payment_method === "bank_transfer" && (
        <Card className="p-3 space-y-3 bg-muted/30">
          {/* Saved accounts selector */}
          {savedBanks.length > 0 && (
            <div>
              <Label className="text-xs mb-1 block">Saved Accounts</Label>
              <div className="space-y-1.5">
                {savedBanks.map((bank) => (
                  <div
                    key={bank.id}
                    onClick={() => selectSavedBank(bank.id)}
                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-all text-xs ${
                      selectedBankId === bank.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium truncate block">
                          {bank.label || bank.bank_name}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {bank.account_name}
                        </span>
                      </div>
                      {bank.is_default && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedBank(bank.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border my-2" />
              <p className="text-[10px] text-muted-foreground mb-1">Or enter new details:</p>
            </div>
          )}

          {/* Manual entry fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Bank Name</Label>
              <Input className="h-8 text-sm" placeholder="Chase Bank" value={config.payment_details.bank_name || ""} onChange={(e) => updateDetail("bank_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Account Name</Label>
              <Input className="h-8 text-sm" placeholder="Your Name / Business" value={config.payment_details.account_name || ""} onChange={(e) => updateDetail("account_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Account Number</Label>
              <Input className="h-8 text-sm" placeholder="••••1234" value={config.payment_details.account_number || ""} onChange={(e) => updateDetail("account_number", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Routing / SWIFT</Label>
              <Input className="h-8 text-sm" placeholder="SWIFT / Sort Code" value={config.payment_details.routing_number || ""} onChange={(e) => updateDetail("routing_number", e.target.value)} />
            </div>
          </div>

          {/* Save button */}
          {config.payment_details.bank_name && config.payment_details.account_number && !isCurrentBankAlreadySaved && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={saveCurrentBank}
              disabled={savingBank}
            >
              <Save className="h-3 w-3" />
              {savingBank ? "Saving..." : "Save this account for next time"}
            </Button>
          )}
        </Card>
      )}

      {config.payment_method === "paypal" && (
        <Card className="p-3 bg-muted/30">
          <Label className="text-xs">PayPal Email</Label>
          <Input className="h-8 text-sm" placeholder="payments@yourstudio.com" value={config.payment_details.paypal_email || ""} onChange={(e) => updateDetail("paypal_email", e.target.value)} />
        </Card>
      )}

      {config.payment_method === "other" && (
        <Card className="p-3 bg-muted/30">
          <Label className="text-xs">Payment Instructions</Label>
          <Textarea className="text-sm" placeholder="Describe how the client should pay..." rows={3} value={config.payment_details.instructions || ""} onChange={(e) => updateDetail("instructions", e.target.value)} />
        </Card>
      )}

      {/* Terms & Conditions */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Terms & Conditions</Label>
          {!config.terms_conditions && (
            <button
              type="button"
              onClick={() => onChange({ ...config, terms_conditions: DEFAULT_TERMS })}
              className="text-[10px] text-white hover:text-[hsl(var(--energy))] hover:underline transition-colors"
            >
              Use default template
            </button>
          )}
        </div>
        <Textarea
          value={config.terms_conditions}
          onChange={(e) => onChange({ ...config, terms_conditions: e.target.value })}
          placeholder="Add payment terms, cancellation policy, late fees..."
          rows={4}
          className="text-sm mt-1"
        />
      </div>
    </div>
  );
}
