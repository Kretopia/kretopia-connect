import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCoins, CheckCircle2, X, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentRequest {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  requested_by: string | null;
  created_at: string;
  requester_name?: string | null;
}

interface Props {
  projectId: string;
  currentUserId: string;
  isOwner: boolean;
  collaborators: Array<{ id: string; full_name: string }>;
  onApproved: () => void;
}

/**
 * Owner-only review queue for collaborator payment requests.
 * Approve → flips milestone to 'approved' + auto-drafts an invoice.
 * Reject → deletes the requested milestone (with confirm).
 */
export function PaymentRequestsReview({ projectId, currentUserId, isOwner, collaborators, onApproved }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("milestones")
      .select("id, title, description, amount, requested_by, created_at")
      .eq("project_id", projectId)
      .eq("status", "requested")
      .order("created_at", { ascending: false });
    const rows = (data as PaymentRequest[]) || [];
    // Hydrate requester names
    const ids = Array.from(new Set(rows.map((r) => r.requested_by).filter(Boolean))) as string[];
    let nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      (profs || []).forEach((p: any) => {
        nameMap[p.user_id] = p.full_name;
      });
    }
    setRequests(rows.map((r) => ({ ...r, requester_name: r.requested_by ? nameMap[r.requested_by] : null })));
  }, [projectId]);

  useEffect(() => {
    if (!isOwner) return;
    fetchRequests();
    const channel = supabase
      .channel(`pay-requests-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestones", filter: `project_id=eq.${projectId}` },
        () => fetchRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, isOwner, fetchRequests]);

  useDeskIntent(
    "finance",
    useCallback((intent) => {
      if (intent !== "review-payment-requests") return;
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);
    }, [])
  );

  if (!isOwner || requests.length === 0) return null;

  const approve = async (req: PaymentRequest) => {
    setBusyId(req.id);
    try {
      // 1. Promote milestone to 'approved' — routed through a validated RPC
      // (see MilestoneBoard.tsx for why status can't be a direct client
      // write); the RPC enforces owner-only for 'approved' specifically,
      // same as this component's own isOwner gate above, now backed
      // server-side instead of only in the UI.
      const { data: upData, error: upRpcErr } = await supabase.rpc('update_milestone_workflow_status', {
        _milestone_id: req.id,
        _status: 'approved',
      });
      const upResult = upData as { success?: boolean; error?: string } | null;
      if (upRpcErr || (upResult && upResult.success !== true)) {
        throw upRpcErr || new Error(upResult?.error || 'Failed to approve');
      }

      // 2. Auto-draft invoice from milestone
      const { data: { user } } = await supabase.auth.getUser();
      const tempNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
      const recipient = collaborators.find((c) => c.id !== currentUserId);
      const lineItems = [
        {
          description: req.title + (req.description ? ` — ${req.description}` : ""),
          quantity: 1,
          rate: Number(req.amount || 0),
          amount: Number(req.amount || 0),
        },
      ];
      const { error: invErr } = await supabase.from("invoices").insert({
        invoice_number: tempNumber,
        project_id: projectId,
        milestone_id: req.id,
        issued_by: user?.id!,
        issued_to: recipient?.id || user?.id!,
        amount: Number(req.amount || 0),
        tax_rate: 0,
        notes: `Auto-drafted from approved payment request: ${req.title}${req.requester_name ? ` (requested by ${req.requester_name})` : ""}`,
        line_items: lineItems as any,
        status: "draft",
        currency: "USD",
        recipient_name: recipient?.full_name || "Client",
        document_type: "invoice",
      } as any);
      if (invErr) throw invErr;

      toast.success("Approved & invoice drafted", {
        description: "Review the draft below, then send it.",
      });
      await fetchRequests();
      onApproved();
    } catch (e: any) {
      console.error("[PaymentRequestsReview] approve", e);
      toast.error(e.message || "Couldn't approve request");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (req: PaymentRequest) => {
    if (!confirm(`Reject "${req.title}"? The collaborator will be able to resubmit.`)) return;
    setBusyId(req.id);
    try {
      const { error } = await supabase.from("milestones").delete().eq("id", req.id);
      if (error) throw error;
      toast.success("Request rejected");
      await fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Couldn't reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div ref={ref}>
      <Card
        className={cn(
          "p-4 border-energy/40 bg-gradient-to-br from-energy/8 to-transparent transition-all",
          highlight && "ring-2 ring-energy/60 shadow-[0_0_24px_hsl(var(--energy)/0.35)]"
        )}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="h-8 w-8 rounded-lg bg-energy/20 text-energy-foreground flex items-center justify-center shrink-0">
            <HandCoins className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm flex items-center gap-2">
              Payment requests
              <Badge variant="outline" className="text-[10px] bg-energy/10 border-energy/30">
                {requests.length}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Approve to draft an invoice, or reject to send it back.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {requests.map((req) => {
            const busy = busyId === req.id;
            return (
              <div
                key={req.id}
                className="rounded-lg border bg-background/60 p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{req.title}</p>
                  {req.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    From {req.requester_name || "collaborator"} · {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base">
                    ${Number(req.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => approve(req)}
                    disabled={busy}
                    className="h-7 text-xs gap-1 bg-energy text-energy-foreground hover:bg-energy/90"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(req)}
                    disabled={busy}
                    className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          Approving creates a draft invoice — review and send below.
        </p>
      </Card>
    </div>
  );
}
