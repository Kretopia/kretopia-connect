import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, FileImage, X, CheckCircle2, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MarkPaidBankTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    amount: number | null;
    total_amount: number | null;
    currency: string | null;
    issued_to: string | null;
  };
  onSuccess: () => void;
}

const ACCEPTED = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export function MarkPaidBankTransferDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: MarkPaidBankTransferDialogProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setBankName("");
    setLast4("");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickFile = (f: File) => {
    if (f.size > MAX_BYTES) {
      toast.error("File too large — please keep it under 8MB");
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!file) {
      toast.error("Please attach the payment receipt");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upload proof to private bucket under issuer's folder
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/invoice-${invoice.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      // 2) Insert manual_bank_transfers row.
      // The issuer is recording payment they received — sender is the invoice recipient
      // (or self if no recipient on file, since sender_id is NOT NULL).
      const senderId = invoice.issued_to ?? user.id;
      const amount = Number(invoice.total_amount ?? invoice.amount ?? 0);

      const { data: transfer, error: insErr } = await supabase
        .from("manual_bank_transfers")
        .insert({
          payment_type: "invoice_payment",
          sender_id: senderId,
          recipient_id: user.id,
          invoice_id: invoice.id,
          amount,
          currency: invoice.currency || "USD",
          sender_bank_name: bankName || null,
          sender_account_last4: last4 || null,
          transfer_date: transferDate || null,
          proof_url: path,
          sender_notes: notes || null,
          // The issuer uploading proof of a bank transfer is real, useful
          // evidence, but it's still self-reported — 'confirmed' is the
          // status admin_confirm_bank_transfer grants after actual review,
          // not something the reporting party can self-assign. Leaving
          // this row 'pending' lets that existing, already-correct RPC
          // (see migration 20260417191317...sql) remain the sole path to
          // 'confirmed', instead of being silently bypassed here.
          status: "pending",
        } as any)
        .select()
        .single();
      if (insErr) throw insErr;

      // 3) Mark invoice paid — self-reported, but now goes through an
      // audited RPC requiring a payment-method note rather than a bare
      // client-side column flip (see migration
      // 20260812120000_close_self_verification_rls_gaps.sql).
      const { error: invErr } = await supabase.rpc("confirm_invoice_paid_manually", {
        p_invoice_id: invoice.id,
        p_payment_method: `Bank transfer${(transfer as any)?.reference_code ? ` (ref ${(transfer as any).reference_code})` : ""}`,
      });
      if (invErr) throw invErr;

      toast.success("Marked as paid", {
        description: `Receipt saved with ref ${(transfer as any)?.reference_code || ""}`,
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("[MarkPaidBankTransfer]", err);
      toast.error(err?.message || "Couldn't save the payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Mark as paid · Bank transfer
          </DialogTitle>
          <DialogDescription>
            Record an off-platform bank deposit for invoice{" "}
            <span className="font-mono font-semibold">{invoice.invoice_number}</span>.
            Attach the deposit slip or screenshot you received from your client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* File picker */}
          {!file ? (
            <Card
              onClick={() => fileRef.current?.click()}
              className="p-6 text-center border-2 border-dashed cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition"
            >
              <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Tap to attach proof of payment</p>
              <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WEBP or PDF · up to 8MB</p>
            </Card>
          ) : (
            <Card className="p-3">
              <div className="flex items-start gap-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="proof" className="h-16 w-16 object-cover rounded-md border" />
                ) : (
                  <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center">
                    <FileImage className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setFile(null); setPreviewUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />

          {/* Optional metadata */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Sender's bank <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder="e.g. Republic Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label className="text-xs">Last 4 digits <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder="1234"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Transfer date</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div>
            <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              className="text-sm"
              rows={2}
              placeholder="Reference number, payer name, anything useful…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 gap-1.5"
            onClick={handleSubmit}
            disabled={submitting || !file}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Mark paid</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
