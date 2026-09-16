import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, Plus, Clock, CheckCircle2, AlertTriangle, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContractBuilder } from "./ContractBuilder";
import { ContractViewer } from "./ContractViewer";
import { formatDistanceToNow } from "date-fns";
import { useDeskIntent } from "@/hooks/useDeskIntent";

interface ContractsListProps {
  projectId: string;
  currentUserId: string;
  collaborators: any[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: "Draft", icon: Clock, color: "bg-muted text-muted-foreground" },
  pending_signature: { label: "Awaiting Signature", icon: FileSignature, color: "bg-amber-500/10 text-amber-600" },
  active: { label: "Active", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-primary/10 text-primary" },
  disputed: { label: "Disputed", icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", icon: Clock, color: "bg-muted text-muted-foreground" },
};

const TYPE_LABELS: Record<string, string> = {
  service_agreement: "Service Agreement",
  nda: "NDA",
  work_for_hire: "Work for Hire",
  collaboration: "Collaboration",
  custom: "Custom",
};

export function ContractsList({ projectId, currentUserId, collaborators }: ContractsListProps) {
  const [view, setView] = useState<"list" | "create" | "view">("list");
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const { data: contracts = [], isLoading, refetch } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (view === "create") {
    return (
      <ContractBuilder
        projectId={projectId}
        currentUserId={currentUserId}
        collaborators={collaborators}
        onBack={() => { setView("list"); refetch(); }}
      />
    );
  }

  if (view === "view" && selectedContractId) {
    return (
      <ContractViewer
        contractId={selectedContractId}
        currentUserId={currentUserId}
        onBack={() => { setView("list"); setSelectedContractId(null); refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Agreements
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, sign, and verify project agreements
          </p>
        </div>
        <Button onClick={() => { setView("create"); import("@/lib/analytics").then(({ analytics }) => analytics.featureUsed("contract_builder_opened", { project_id: projectId })); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Agreement
        </Button>
      </div>

      {/* Blockchain badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          Agreements are hashed and can be anchored to the <span className="text-primary font-medium">Polygon blockchain</span> for tamper-proof verification.
        </p>
      </div>

      {/* Contract list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-10 px-4 border-2 border-dashed border-border rounded-xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FileSignature className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Lock in the agreement</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Pick a template or build from scratch — protect scope, timeline, and payment in minutes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={() => setView("create")} size="sm" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Use a template
            </Button>
            <Button onClick={() => setView("create")} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" /> Build from scratch
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => {
            const status = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
            const StatusIcon = status.icon;
            return (
              <button
                key={contract.id}
                onClick={() => { setSelectedContractId(contract.id); setView("view"); }}
                className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{contract.title}</p>
                      {contract.blockchain_tx_hash && (
                        <Badge variant="outline" className="text-[10px] gap-1 shrink-0 border-primary/30 text-primary">
                          <Shield className="h-3 w-3" /> On-chain
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{TYPE_LABELS[contract.contract_type] || contract.contract_type}</span>
                      {contract.total_amount && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-foreground">
                            {contract.currency} {Number(contract.total_amount).toLocaleString()}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(contract.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0 gap-1", status.color)} variant="secondary">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </div>

                {/* Signature progress */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={cn("w-2 h-2 rounded-full", contract.party_a_signed_at ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                    <span className="text-muted-foreground">Party A {contract.party_a_signed_at ? "signed" : "pending"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={cn("w-2 h-2 rounded-full", contract.party_b_signed_at ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                    <span className="text-muted-foreground">Party B {contract.party_b_signed_at ? "signed" : "pending"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
