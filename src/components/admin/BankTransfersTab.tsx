import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Banknote, CheckCircle2, XCircle, ExternalLink, Loader2, Clock, FileImage } from "lucide-react";
import { format } from "date-fns";

interface ManualTransfer {
  id: string;
  reference_code: string;
  payment_type: string;
  sender_id: string;
  recipient_id: string | null;
  amount: number;
  currency: string;
  proof_url: string;
  sender_bank_name: string | null;
  sender_account_last4: string | null;
  transfer_date: string | null;
  sender_notes: string | null;
  status: string;
  admin_notes: string | null;
  rejected_reason: string | null;
  recipient_bank_snapshot: any;
  created_at: string;
  confirmed_at: string | null;
  sender?: { full_name: string | null; user_id: string };
  recipient?: { full_name: string | null; user_id: string } | null;
}

export function BankTransfersTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<ManualTransfer[]>([]);
  const [selected, setSelected] = useState<ManualTransfer | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manual_bank_transfers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: "Failed to load transfers", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set([
      ...(data || []).map((t: any) => t.sender_id),
      ...(data || []).map((t: any) => t.recipient_id).filter(Boolean),
    ]));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const byId = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const enriched = (data || []).map((t: any) => ({
      ...t,
      sender: byId.get(t.sender_id),
      recipient: t.recipient_id ? byId.get(t.recipient_id) : null,
    }));

    setTransfers(enriched as ManualTransfer[]);
    setLoading(false);
  };

  const getProofUrl = async (transfer: ManualTransfer) => {
    if (proofUrls[transfer.id]) return proofUrls[transfer.id];
    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(transfer.proof_url, 3600);
    if (data?.signedUrl) {
      setProofUrls((prev) => ({ ...prev, [transfer.id]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  const handleAction = async () => {
    if (!selected || !actionType) return;
    setSubmitting(true);
    try {
      if (actionType === "confirm") {
        const { error } = await supabase.rpc("admin_confirm_bank_transfer", {
          p_transfer_id: selected.id,
          p_admin_notes: adminNotes || null,
        });
        if (error) throw error;
        toast({ title: "Transfer confirmed", description: "Funds credited to user." });
      } else {
        if (!adminNotes.trim()) {
          toast({ title: "Reason required", description: "Please provide a rejection reason.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.rpc("admin_reject_bank_transfer", {
          p_transfer_id: selected.id,
          p_reason: adminNotes,
        });
        if (error) throw error;
        toast({ title: "Transfer rejected" });
      }
      setSelected(null);
      setActionType(null);
      setAdminNotes("");
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderList = (list: ManualTransfer[]) => (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No transfers in this category.</p>
      )}
      {list.map((t) => (
        <Card key={t.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{t.reference_code}</code>
                  <Badge variant={
                    t.status === "pending" ? "secondary" :
                    t.status === "confirmed" ? "default" :
                    "destructive"
                  }>
                    {t.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {t.status === "confirmed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {t.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                    {t.status}
                  </Badge>
                  <Badge variant="outline">{t.payment_type === "wallet_topup" ? "Wallet Top-up" : "Invoice Payment"}</Badge>
                </div>
                <div className="text-2xl font-bold">{t.currency} {Number(t.amount).toFixed(2)}</div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {format(new Date(t.created_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">From</p>
                <p className="font-medium">{t.sender?.full_name || "Unknown"}</p>
                {t.sender_bank_name && (
                  <p className="text-xs text-muted-foreground">
                    {t.sender_bank_name}{t.sender_account_last4 ? ` ••${t.sender_account_last4}` : ""}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium">{t.recipient?.full_name || "Kretopia Wallet"}</p>
                {t.recipient_bank_snapshot?.bank_name && (
                  <p className="text-xs text-muted-foreground">
                    {t.recipient_bank_snapshot.bank_name} • {t.recipient_bank_snapshot.account_number}
                  </p>
                )}
              </div>
            </div>

            {t.transfer_date && (
              <p className="text-xs text-muted-foreground">
                Sender claims transferred on: {format(new Date(t.transfer_date), "MMM d, yyyy")}
              </p>
            )}
            {t.sender_notes && (
              <div className="text-sm bg-muted/50 p-2 rounded">
                <span className="text-xs text-muted-foreground">Note: </span>{t.sender_notes}
              </div>
            )}
            {t.rejected_reason && (
              <div className="text-sm bg-destructive/10 text-destructive p-2 rounded">
                <span className="text-xs font-medium">Rejection reason: </span>{t.rejected_reason}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = await getProofUrl(t);
                  if (url) window.open(url, "_blank");
                }}
              >
                <FileImage className="h-3.5 w-3.5 mr-1.5" />
                View Proof
                <ExternalLink className="h-3 w-3 ml-1.5" />
              </Button>
              {t.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => { setSelected(t); setActionType("confirm"); setAdminNotes(""); }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Confirm & Credit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setSelected(t); setActionType("reject"); setAdminNotes(""); }}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const pending = transfers.filter((t) => t.status === "pending");
  const confirmed = transfers.filter((t) => t.status === "confirmed");
  const rejected = transfers.filter((t) => t.status === "rejected" || t.status === "cancelled");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Bank Transfer Confirmations
        </CardTitle>
        <CardDescription>
          Review proof of payment, then confirm to credit funds or reject with a reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed ({confirmed.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected/Cancelled ({rejected.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">{renderList(pending)}</TabsContent>
            <TabsContent value="confirmed" className="mt-4">{renderList(confirmed)}</TabsContent>
            <TabsContent value="rejected" className="mt-4">{renderList(rejected)}</TabsContent>
          </Tabs>
        )}
      </CardContent>

      <Dialog open={!!selected && !!actionType} onOpenChange={(o) => { if (!o) { setSelected(null); setActionType(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "confirm" ? "Confirm Transfer" : "Reject Transfer"}
            </DialogTitle>
            <DialogDescription>
              {selected && `${selected.currency} ${Number(selected.amount).toFixed(2)} • Ref ${selected.reference_code}`}
              <br />
              {actionType === "confirm"
                ? "This will mark the transfer as received and credit the user's wallet (for top-ups)."
                : "Provide a clear reason — the sender will see this."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{actionType === "confirm" ? "Internal note (optional)" : "Rejection reason (required)"}</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={actionType === "confirm" ? "e.g. Verified against bank statement" : "e.g. Amount on proof doesn't match transfer amount"}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setActionType(null); }}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {actionType === "confirm" ? "Confirm & Credit" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
