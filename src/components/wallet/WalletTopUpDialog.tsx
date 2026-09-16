import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, CreditCard, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WalletTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];

export function WalletTopUpDialog({ open, onOpenChange }: WalletTopUpDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [gateway, setGateway] = useState("stripe");
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    if (numAmount > 10000) {
      toast({ title: "Maximum top-up is $10,000", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-topup", {
        body: { amount: numAmount, currency, gateway },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, "_blank");
        onOpenChange(false);
        setAmount("");
      }
    } catch (err: any) {
      toast({
        title: "Top-up failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Funds to Wallet
          </DialogTitle>
          <DialogDescription>
            Top up your Kretopia wallet to send payments and make purchases
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick amounts */}
          <div className="space-y-2">
            <Label>Quick Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === String(preset) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(String(preset))}
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount & currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Custom Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="TTD">TTD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  gateway === "stripe" ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                }`}
                onClick={() => setGateway("stripe")}
              >
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">Card</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard</p>
                </div>
              </button>
              <button
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors opacity-50 cursor-not-allowed`}
                disabled
              >
                <Landmark className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-medium">WiPay</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleTopUp} disabled={loading || !amount || Number(amount) <= 0}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" />Add ${amount || "0.00"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
