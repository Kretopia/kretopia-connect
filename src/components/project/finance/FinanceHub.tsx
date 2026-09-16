import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Receipt,
  Link2,
} from "lucide-react";
import { MilestoneBoard } from "@/components/project/MilestoneBoard";
import { InvoiceGenerator } from "@/components/project/InvoiceGenerator";
import { MarkPaidBankTransferDialog } from "@/components/project/finance/MarkPaidBankTransferDialog";
import { PaymentRequestsReview } from "@/components/project/finance/PaymentRequestsReview";
import { Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { APP_URL } from "@/lib/constants";

interface FinanceHubProps {
  projectId: string;
  project: any;
  milestones: any[];
  collaborators: Array<{ id: string; full_name: string }>;
  currentUserId: string;
  userRole: "creator" | "client";
  onUpdate: () => void;
}

interface InvoiceLite {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number | null;
  amount: number | null;
  currency: string | null;
  recipient_name: string | null;
  due_date: string | null;
  document_type: string | null;
  milestone_id: string | null;
  created_at: string;
  issued_to: string | null;
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/30",
  sent: "bg-primary/15 text-primary border-primary/30",
  viewed: "bg-energy/15 text-energy-foreground border-energy/30",
  draft: "bg-muted text-muted-foreground border-border",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
};

export function FinanceHub({
  projectId,
  project,
  milestones,
  collaborators,
  currentUserId,
  userRole,
  onUpdate,
}: FinanceHubProps) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceLite | null>(null);
  const invoiceTriggerRef = useRef<HTMLDivElement>(null);
  const milestonesRef = useRef<HTMLDivElement>(null);

  // Intent: scroll to relevant section / nudge invoice creation
  useDeskIntent("finance", useCallback((intent) => {
    if (intent === "create-invoice") {
      invoiceTriggerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Trigger the InvoiceGenerator dialog button if present
      const btn = invoiceTriggerRef.current?.querySelector("button");
      btn?.click();
    } else if (intent === "create-milestone" || intent === "request-deposit") {
      milestonesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []));

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total_amount, amount, currency, recipient_name, due_date, document_type, milestone_id, created_at, issued_to"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setInvoices((data as InvoiceLite[]) || []);
  };

  useEffect(() => {
    fetchInvoices();
    // Realtime sync so embedded clients see new invoices immediately
    const channel = supabase
      .channel(`finance-invoices-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `project_id=eq.${projectId}` },
        () => fetchInvoices()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Budget math
  const totals = useMemo(() => {
    const milestoneTotal = milestones.reduce((s, m) => s + Number(m.amount || 0), 0);
    const milestonePaid = milestones
      .filter((m) => m.status === "paid" || m.escrow_status === "captured")
      .reduce((s, m) => s + Number(m.amount || 0), 0);
    const milestoneEscrow = milestones
      .filter((m) => m.escrow_status === "authorized")
      .reduce((s, m) => s + Number(m.amount || 0), 0);

    const invoiced = invoices
      .filter((i) => (i.document_type || "invoice") === "invoice")
      .reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);
    const invoicePaid = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);
    const invoiceOpen = invoices
      .filter((i) => ["sent", "viewed", "overdue"].includes(i.status))
      .reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);

    return {
      milestoneTotal,
      milestonePaid,
      milestoneEscrow,
      invoiced,
      invoicePaid,
      invoiceOpen,
      totalEarned: milestonePaid + invoicePaid,
      totalPending: milestoneTotal - milestonePaid + invoiceOpen,
    };
  }, [milestones, invoices]);

  const progressPct = totals.milestoneTotal
    ? Math.min(100, (totals.milestonePaid / totals.milestoneTotal) * 100)
    : 0;

  // ===== Outside-client share link =====
  const handleShareInvoice = async (invoice: InvoiceLite) => {
    const url = `${APP_URL}/invoice/${invoice.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Pay link copied", { description: "Share with anyone — no login needed." });
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  // ===== Bill this milestone (AI-suggested line items) =====
  const handleBillMilestone = async (milestone: any) => {
    setLoading(true);
    try {
      // Build prefilled line items from milestone scope
      const baseItems: any[] = [
        {
          description: milestone.title + (milestone.description ? ` — ${milestone.description}` : ""),
          quantity: 1,
          rate: Number(milestone.amount || 0),
          amount: Number(milestone.amount || 0),
        },
      ];

      const { data: { user } } = await supabase.auth.getUser();
      const tempNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: tempNumber,
          project_id: projectId,
          milestone_id: milestone.id,
          issued_by: user?.id!,
          issued_to: collaborators.find((c) => c.id !== currentUserId)?.id || user?.id!,
          amount: Number(milestone.amount || 0),
          tax_rate: 0,
          due_date: milestone.due_date,
          notes: `Auto-drafted from milestone: ${milestone.title}`,
          line_items: baseItems as any,
          status: "draft",
          currency: "USD",
          recipient_name: collaborators.find((c) => c.id !== currentUserId)?.full_name || "Client",
          document_type: "invoice",
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Invoice drafted from milestone", {
        description: "Open Invoices below to review, edit, and send.",
      });
      fetchInvoices();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Couldn't draft invoice");
    } finally {
      setLoading(false);
    }
  };

  // Milestones without invoices (encouraged to bill)
  const unbilledMilestones = milestones.filter(
    (m) => !invoices.some((i) => i.milestone_id === m.id) && m.status !== "paid"
  );

  return (
    <div className="space-y-6">
      {/* ============= HERO BUDGET BAR ============= */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-energy/5 border-primary/20">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
              Project Finance
            </p>
            <h2 className="text-2xl md:text-3xl font-black">
              ${totals.totalEarned.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-base font-medium text-muted-foreground ml-2">earned</span>
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/thrivepay")}
            className="gap-2 shrink-0"
          >
            <Wallet className="h-3.5 w-3.5" />
            KrePay P&L
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              ${totals.milestonePaid.toFixed(0)} of ${totals.milestoneTotal.toFixed(0)} milestone budget
            </span>
            <span className="font-bold text-primary">{progressPct.toFixed(0)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatPill
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Paid"
            value={`$${totals.milestonePaid.toFixed(0)}`}
            tone="success"
          />
          <StatPill
            icon={<Clock className="h-3.5 w-3.5" />}
            label="In escrow"
            value={`$${totals.milestoneEscrow.toFixed(0)}`}
            tone="energy"
          />
          <StatPill
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="Open invoices"
            value={`$${totals.invoiceOpen.toFixed(0)}`}
            tone="primary"
          />
          <StatPill
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Total pending"
            value={`$${totals.totalPending.toFixed(0)}`}
            tone="muted"
          />
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
          <Link2 className="h-3 w-3" />
          Every paid milestone & invoice automatically syncs to your KrePay P&L.
        </p>
      </Card>

      {/* ============= UNBILLED MILESTONES NUDGE ============= */}
      {userRole === "creator" && unbilledMilestones.length > 0 && (
        <Card className="p-4 border-energy/40 bg-energy/5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-energy/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-energy-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {unbilledMilestones.length} milestone{unbilledMilestones.length > 1 ? "s" : ""} ready to invoice
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate a branded invoice in one click — line items are pre-filled from the milestone scope.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {unbilledMilestones.slice(0, 4).map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => handleBillMilestone(m)}
                    className="h-7 text-xs gap-1.5 border-primary/30 hover:bg-primary/10"
                  >
                    <FileText className="h-3 w-3" />
                    Bill "{m.title.length > 22 ? m.title.slice(0, 22) + "…" : m.title}" — ${Number(m.amount || 0).toFixed(0)}
                  </Button>
                ))}
                {unbilledMilestones.length > 4 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{unbilledMilestones.length - 4} more below
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ============= COLLABORATOR PAYMENT REQUESTS (owner only) ============= */}
      {userRole === "creator" && (
        <PaymentRequestsReview
          projectId={projectId}
          currentUserId={currentUserId}
          isOwner={project?.created_by === currentUserId}
          collaborators={collaborators}
          onApproved={() => { fetchInvoices(); onUpdate?.(); }}
        />
      )}

      {/* ============= MILESTONES SECTION ============= */}
      <div ref={milestonesRef}>
        <SectionHeader
          icon={<DollarSign className="h-4 w-4" />}
          title="Milestones"
          subtitle="Break the project into payable chunks. Use escrow to lock in funds."
        />
        <div className="mt-2 -mx-4 md:mx-0">
          <MilestoneBoard
            milestones={milestones}
            projectId={projectId}
            onUpdate={onUpdate}
            userRole={userRole}
            collaborators={collaborators}
            projectOwnerId={project?.created_by}
          />
        </div>
      </div>

      {/* ============= INVOICES SECTION ============= */}
      <div ref={invoiceTriggerRef}>
        <SectionHeader
          icon={<Receipt className="h-4 w-4" />}
          title="Invoices & Quotes"
          subtitle="Send branded invoices. Outside clients can pay via shareable link."
          action={<InvoiceGenerator projectId={projectId} />}
        />

        {invoices.length === 0 ? (
          <Card className="p-8 text-center mt-3 border-2 border-dashed">
            <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-semibold text-sm">Get paid faster</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              Request a deposit, set milestones, or send a branded invoice — clients can pay via a share link.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => milestonesRef.current?.scrollIntoView({ behavior: "smooth" })} className="gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Add milestone
              </Button>
              <Button size="sm" onClick={() => invoiceTriggerRef.current?.querySelector("button")?.click()} className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Request deposit
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2 mt-3">
            {invoices.map((inv) => {
              const linkedMilestone = milestones.find((m) => m.id === inv.milestone_id);
              const isQuote = (inv.document_type || "invoice") === "quote";
              return (
                <Card key={inv.id} className="p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-mono text-xs font-bold">{inv.invoice_number}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] capitalize", STATUS_TONE[inv.status] || STATUS_TONE.draft)}
                        >
                          {inv.status}
                        </Badge>
                        {isQuote && (
                          <Badge variant="outline" className="text-[10px] bg-energy/10 text-energy-foreground border-energy/30">
                            Quote
                          </Badge>
                        )}
                        {linkedMilestone && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Link2 className="h-2.5 w-2.5" />
                            {linkedMilestone.title.slice(0, 18)}
                            {linkedMilestone.title.length > 18 ? "…" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 truncate">{inv.recipient_name || "Client"}</p>
                      {inv.due_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Due {new Date(inv.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base">
                        ${Number(inv.total_amount || inv.amount || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{inv.currency || "USD"}</p>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-1.5 mt-2 pt-2 border-t flex-wrap">
                    {inv.status !== "draft" && inv.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleShareInvoice(inv)}
                        className="h-7 text-xs gap-1"
                      >
                        <Link2 className="h-3 w-3" />
                        Copy pay link
                      </Button>
                    )}
                    {userRole === "creator" && !isQuote && inv.status !== "paid" && inv.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMarkPaidInvoice(inv)}
                        className="h-7 text-xs gap-1 border-success/40 text-success hover:bg-success/10 hover:text-success"
                      >
                        <Landmark className="h-3 w-3" />
                        Mark paid · bank
                      </Button>
                    )}
                    {userRole === "client" && ["sent", "viewed", "overdue"].includes(inv.status) && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/invoice/${inv.id}`)}
                        className="h-7 text-xs gap-1 ml-auto"
                      >
                        <DollarSign className="h-3 w-3" />
                        Pay now
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {markPaidInvoice && (
        <MarkPaidBankTransferDialog
          open={!!markPaidInvoice}
          onOpenChange={(v) => { if (!v) setMarkPaidInvoice(null); }}
          invoice={markPaidInvoice}
          onSuccess={() => { setMarkPaidInvoice(null); fetchInvoices(); onUpdate?.(); }}
        />
      )}
    </div>
  );
}

/* ===== Subcomponents ===== */

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "energy" | "primary" | "muted";
}) {
  const toneMap = {
    success: "bg-success/10 text-success border-success/20",
    energy: "bg-energy/10 text-energy-foreground border-energy/20",
    primary: "bg-primary/10 text-primary border-primary/20",
    muted: "bg-muted text-foreground border-border",
  };
  return (
    <div className={cn("rounded-lg border p-2", toneMap[tone])}>
      <div className="flex items-center gap-1.5 mb-0.5 opacity-80">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
