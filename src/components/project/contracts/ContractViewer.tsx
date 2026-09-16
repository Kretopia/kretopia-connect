import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileSignature, Shield, CheckCircle2, Clock, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { ContractDisclaimer } from "@/components/legal/ContractDisclaimer";

interface ContractViewerProps {
  contractId: string;
  currentUserId: string;
  onBack: () => void;
}

async function generateContractHash(contract: any): Promise<string> {
  const content = JSON.stringify({
    title: contract.title,
    description: contract.description,
    contract_type: contract.contract_type,
    terms: contract.terms,
    total_amount: contract.total_amount,
    currency: contract.currency,
    party_a_user_id: contract.party_a_user_id,
    party_b_user_id: contract.party_b_user_id,
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function ContractViewer({ contractId, currentUserId, onBack }: ContractViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [agreedToDisclaimer, setAgreedToDisclaimer] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select("*")
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return;
      const isPartyA = contract.party_a_user_id === currentUserId;
      const isPartyB = contract.party_b_user_id === currentUserId;
      if (!isPartyA && !isPartyB) throw new Error("You are not a party to this contract");

      const updates: any = {};
      if (isPartyA && !contract.party_a_signed_at) {
        updates.party_a_signed_at = new Date().toISOString();
      } else if (isPartyB && !contract.party_b_signed_at) {
        updates.party_b_signed_at = new Date().toISOString();
      } else {
        throw new Error("You have already signed this contract");
      }

      // Check if both parties will have signed after this
      const bothSigned = (isPartyA && contract.party_b_signed_at) || (isPartyB && contract.party_a_signed_at);
      if (bothSigned) {
        updates.status = "active";
        updates.contract_hash = await generateContractHash(contract);
      } else if (contract.status === "draft") {
        updates.status = "pending_signature";
      }

      const { error } = await supabase
        .from("project_contracts")
        .update(updates)
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contract signed ✍️", description: "Your signature has been recorded." });
      import("@/lib/analytics").then(({ analytics }) => {
        analytics.featureUsed("contract_signed", { contract_id: contractId });
      });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyHash = () => {
    if (contract?.contract_hash) {
      navigator.clipboard.writeText(contract.contract_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading || !contract) {
    return <div className="animate-pulse space-y-3"><div className="h-8 bg-muted rounded" /><div className="h-40 bg-muted rounded-xl" /></div>;
  }

  const terms = contract.terms as any;
  const sections: { title: string; content: string }[] = terms?.sections || [];
  const isPartyA = contract.party_a_user_id === currentUserId;
  const isPartyB = contract.party_b_user_id === currentUserId;
  const canSign = (isPartyA && !contract.party_a_signed_at) || (isPartyB && !contract.party_b_signed_at);
  const bothSigned = !!contract.party_a_signed_at && !!contract.party_b_signed_at;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Contracts
      </Button>

      {/* Contract header */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{contract.title}</h2>
            {contract.description && <p className="text-sm text-muted-foreground mt-1">{contract.description}</p>}
          </div>
          <Badge variant="secondary" className={cn(
            "shrink-0",
            contract.status === "active" && "bg-emerald-500/10 text-emerald-600",
            contract.status === "pending_signature" && "bg-amber-500/10 text-amber-600",
            contract.status === "draft" && "bg-muted text-muted-foreground"
          )}>
            {contract.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>Created {format(new Date(contract.created_at), "MMM d, yyyy")}</span>
          {contract.total_amount && (
            <span className="font-semibold text-foreground">{contract.currency} {Number(contract.total_amount).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn("p-3 rounded-xl border", contract.party_a_signed_at ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card")}>
          <div className="flex items-center gap-2 mb-1">
            {contract.party_a_signed_at ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs font-semibold">Party A {isPartyA && "(You)"}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {contract.party_a_signed_at ? `Signed ${format(new Date(contract.party_a_signed_at), "MMM d, yyyy h:mm a")}` : "Awaiting signature"}
          </p>
        </div>
        <div className={cn("p-3 rounded-xl border", contract.party_b_signed_at ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card")}>
          <div className="flex items-center gap-2 mb-1">
            {contract.party_b_signed_at ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs font-semibold">Party B {isPartyB && "(You)"}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {contract.party_b_signed_at ? `Signed ${format(new Date(contract.party_b_signed_at), "MMM d, yyyy h:mm a")}` : contract.party_b_user_id ? "Awaiting signature" : "Not assigned"}
          </p>
        </div>
      </div>

      {/* Sign button + legal acknowledgement */}
      {canSign && contract.status !== "cancelled" && (
        <div className="space-y-3 p-3 rounded-xl border border-border bg-card">
          <ContractDisclaimer variant="banner" />
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={agreedToDisclaimer}
              onCheckedChange={(c) => setAgreedToDisclaimer(c === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I understand this is a private agreement, not legal advice. Enforceability and required clauses
              depend on my jurisdiction. I'm signing of my own free will.
            </span>
          </label>
          <Button
            onClick={() => signMutation.mutate()}
            disabled={signMutation.isPending || !agreedToDisclaimer}
            className="w-full gap-2"
          >
            <FileSignature className="h-4 w-4" />
            {signMutation.isPending ? "Signing..." : "Sign Contract"}
          </Button>
        </div>
      )}

      {/* Blockchain verification */}
      {contract.contract_hash && (
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {contract.blockchain_tx_hash ? "Blockchain Verified" : "Contract Hash Generated"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[10px] text-muted-foreground bg-background/50 px-2 py-1 rounded flex-1 truncate font-mono">
              {contract.contract_hash}
            </code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyHash}>
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {contract.blockchain_tx_hash ? (
            <a
              href={`https://polygonscan.com/tx/${contract.blockchain_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              View on Polygonscan →
            </a>
          ) : (
            <p className="text-[10px] text-muted-foreground">Blockchain anchoring available in Phase 2</p>
          )}
        </div>
      )}

      {/* Contract terms */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Contract Terms</h3>
        {sections.length > 0 ? (
          sections.map((section, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-card">
              <p className="font-medium text-sm mb-1">{section.title}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content || "—"}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No terms defined.</p>
        )}
        <ContractDisclaimer variant="footer" />
      </div>
    </div>
  );
}
