import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { DuplicateCandidate } from "@/hooks/useDuplicateAccounts";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidate: DuplicateCandidate | null;
  onMerged?: () => void;
}

type Step = "intro" | "sending" | "codes" | "merging" | "done";

export const MergeAccountsDialog = ({ open, onOpenChange, candidate, onMerged }: Props) => {
  const [step, setStep] = useState<Step>("intro");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [sourceMasked, setSourceMasked] = useState<string>("");
  const [targetMasked, setTargetMasked] = useState<string>("");
  const [sourceOtp, setSourceOtp] = useState("");
  const [targetOtp, setTargetOtp] = useState("");

  const reset = () => {
    setStep("intro");
    setRequestId(null);
    setSourceOtp("");
    setTargetOtp("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const startMerge = async () => {
    if (!candidate) return;
    setStep("sending");
    try {
      const { data, error } = await supabase.functions.invoke("merge-accounts-init", {
        body: { source_user_id: candidate.candidate_user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRequestId(data.request_id);
      setSourceMasked(data.source_email_masked);
      setTargetMasked(data.target_email_masked);
      setStep("codes");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start merge");
      setStep("intro");
    }
  };

  const submitCodes = async () => {
    if (!requestId || sourceOtp.length !== 6 || targetOtp.length !== 6) {
      toast.error("Enter both 6-digit codes");
      return;
    }
    setStep("merging");
    try {
      const { data, error } = await supabase.functions.invoke("merge-accounts-verify", {
        body: { request_id: requestId, source_otp: sourceOtp, target_otp: targetOtp },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStep("done");
      onMerged?.();
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
      setStep("codes");
    }
  };

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Merge accounts
          </DialogTitle>
          <DialogDescription>
            Combine this account into your current one. Your data, credits & connections move over.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
              <Avatar className="h-12 w-12">
                <AvatarImage src={candidate.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(candidate.full_name || "?").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{candidate.full_name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {candidate.masked_email}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {candidate.match_phone && <Tag>Same phone</Tag>}
                  {candidate.match_email_local && <Tag>Email match</Tag>}
                  {candidate.match_name && <Tag>Name match</Tag>}
                  {candidate.overlap_count >= 3 && (
                    <Tag>{candidate.overlap_count} mutual</Tag>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                We'll email a 6-digit code to <b>both</b> addresses. You'll need access to
                each inbox. The other account will be permanently deleted after merging.
              </span>
            </div>
            <Button onClick={startMerge} className="w-full">
              Send verification codes <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "sending" && <Spinner label="Sending codes…" />}

        {step === "codes" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent codes to <b>{sourceMasked}</b> and <b>{targetMasked}</b>. Enter
              both to confirm.
            </p>
            <div className="space-y-2">
              <Label>Code sent to {sourceMasked}</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={sourceOtp}
                onChange={(e) => setSourceOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-lg tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label>Code sent to {targetMasked}</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={targetOtp}
                onChange={(e) => setTargetOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button onClick={submitCodes} className="w-full">
              Verify & merge
            </Button>
          </div>
        )}

        {step === "merging" && <Spinner label="Merging accounts…" />}

        {step === "done" && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold">Accounts merged</p>
            <p className="text-sm text-muted-foreground">
              Your credits, connections and history are now in one place.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
    {children}
  </span>
);

const Spinner = ({ label }: { label: string }) => (
  <div className="py-10 flex flex-col items-center gap-3">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);
