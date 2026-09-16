import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, Search, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onTransferComplete: () => void;
}

export function WalletTransferDialog({ open, onOpenChange, walletBalance, onTransferComplete }: WalletTransferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  // Stable across retries of the same submit attempt (e.g. a slow
  // response the user gives up on and retries) so the server can dedupe;
  // regenerated whenever the dialog closes, so the next transfer gets a
  // fresh key rather than reusing a completed one.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!open) {
      setAmount("");
      setDescription("");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedRecipient(null);
      setError("");
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    if (!user) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .neq("user_id", user.id)
        .ilike("full_name", `%${query}%`)
        .limit(5);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedRecipient || !amount || Number(amount) <= 0) {
      setError("Please select a recipient and enter a valid amount");
      return;
    }

    if (Number(amount) > walletBalance) {
      setError("Insufficient balance");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("wallet-transfer", {
        body: {
          recipientId: selectedRecipient.user_id,
          amount: Number(amount),
          currency,
          description: description || undefined,
          idempotencyKey: idempotencyKeyRef.current,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Transfer Successful!",
        description: `$${Number(amount).toFixed(2)} ${currency} sent to ${data.recipientName}`,
      });

      onTransferComplete();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Money
          </DialogTitle>
          <DialogDescription>
            Transfer funds from your wallet to another Kretopia user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient Search */}
          <div className="space-y-2">
            <Label>Recipient</Label>
            {selectedRecipient ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedRecipient.avatar_url} />
                    <AvatarFallback>{selectedRecipient.full_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{selectedRecipient.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedRecipient.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRecipient(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                    {searchResults.map((person) => (
                      <button
                        key={person.user_id}
                        className="flex items-center gap-3 w-full p-3 hover:bg-accent/50 transition-colors text-left"
                        onClick={() => {
                          setSelectedRecipient(person);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person.avatar_url} />
                          <AvatarFallback>{person.full_name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{person.full_name}</p>
                          <p className="text-xs text-muted-foreground">{person.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
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
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "BRL", "ZAR", "INR", "NGN", "IDR", "TTD", "AED", "KES"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Available: ${walletBalance.toFixed(2)} USD
          </p>

          {/* Description */}
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input
              placeholder="What's this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleTransfer}
            disabled={loading || !selectedRecipient || !amount || Number(amount) <= 0}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" />Send {amount ? `$${Number(amount).toFixed(2)}` : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
