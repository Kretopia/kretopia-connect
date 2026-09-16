import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { FeeStructure } from "@/components/FeeStructure";
import { FeeCalculator } from "@/components/FeeCalculator";
import { getFeeDisplayText } from "@/lib/platformFees";
import { EmptyState } from "@/components/ui/empty-state";

import { WalletTopUpDialog } from "@/components/wallet/WalletTopUpDialog";
import { ThriveWalletCard } from "@/components/wallet/ThriveWalletCard";
import { WalletTransferDialog } from "@/components/wallet/WalletTransferDialog";
import { AccountingDashboard } from "@/components/project/AccountingDashboard";
import { FreeTierGate } from "@/components/FreeTierGate";
import { KrePayDashboard } from "@/components/thrivepay/KrePayDashboard";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { SnapReceiptFAB } from "@/components/thrivepay/SnapReceiptFAB";
import { PaymentLinksSection } from "@/components/thrivepay/PaymentLinksSection";
import { KrePayAIInsights } from "@/components/thrivepay/KrePayAIInsights";
import { TransactionDetailDrawer, type TransactionDetail } from "@/components/thrivepay/TransactionDetailDrawer";
import { TrustControlsCard } from "@/components/thrivepay/TrustControlsCard";
import { InvoiceSepaBeneficiaryCard } from "@/components/thrivepay/InvoiceSepaBeneficiaryCard";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretoTip } from "@/components/agent/KretoTip";
import { KREPAY_BRAND_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Zap,
  Percent,
  Landmark,
  Plus,
  Loader2,
  Wallet,
  Sparkles,
  Send,
  Briefcase,
  FileText,
  Receipt,
  FilePlus,
  MoreHorizontal,
} from "lucide-react";

const KREPAY_TUTORIAL: TutorialStep[] = [
  { icon: Wallet, title: "See what's coming in", body: "Your wallet balance, available funds, and pending payouts — all in one glance." },
  { icon: Send, title: "Get paid in seconds", body: "Share a payment link or send an invoice — no waiting on a bank transfer to clear." },
  { icon: FileText, title: "Track invoices & expenses", body: "Every invoice, quote, and expense lives here, so nothing falls through at tax time." },
];

interface ConnectRequirements {
  status: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  disabledReason?: string | null;
  requirements: string[];
  pastDue: number;
  currentlyDue: number;
  eventuallyDue: number;
  deadline?: string | null;
}

export default function ThrivePay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isBrand, setIsBrand] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string>("not_connected");
  const [balance, setBalance] = useState({ available: 0, pending: 0, currency: "usd" });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>("free");
  const [connectDetails, setConnectDetails] = useState<ConnectRequirements | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Wallet state
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "earnings";
  });

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Account Connected!",
        description: "Your Stripe account has been successfully connected.",
      });
      navigate("/thrivepay", { replace: true });
    }

    // Handle top-up success
    if (searchParams.get("topup") === "success") {
      const topupId = searchParams.get("topup_id");
      if (topupId) {
        supabase.functions.invoke("wallet-topup-confirm", {
          body: { topupId },
        }).then(({ data }) => {
          if (data?.success) {
            toast({
              title: "Wallet Topped Up!",
              description: `$${data.amount?.toFixed(2)} has been added to your wallet.`,
            });
          }
        });
      }
      navigate("/thrivepay", { replace: true });
    }

    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }

    if (user) {
      fetchAccountStatus();
      fetchWallet();
    }
  }, [user, searchParams]);

  // Brand accounts pay creators rather than getting paid for their own
  // creative work — the wallet/Stripe/invoicing mechanics underneath are
  // identical either way (money in/out works the same regardless of
  // account type), so this only swaps the header framing and tutorial,
  // not any data-fetching or payment logic.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsBrand(data?.account_type === "company"));
  }, [user]);

  // --- Payment account / Connect logic ---
  const fetchAccountStatus = async () => {
    try {
      setLoading(true);
      const { data: rows } = await supabase.rpc("get_own_payment_identifiers");
      const profile = Array.isArray(rows) ? rows[0] : rows;

      if (profile?.subscription_tier) setSubscriptionTier(profile.subscription_tier);

      if (profile?.stripe_account_id) {
        setAccountId(profile.stripe_account_id);
        setConnectStatus(profile.stripe_account_status || "pending");

        if (profile.stripe_account_status === "active") {
          const { data: balanceData } = await supabase.functions.invoke("get-connect-balance");
          if (balanceData && !balanceData.error) setBalance(balanceData);
        }

        if (profile.stripe_account_status === "pending" || profile.stripe_account_status === "restricted") {
          await checkConnectStatus();
        }
      }
    } catch (error) {
      console.error("Error fetching account status:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectStatus = async () => {
    try {
      setCheckingStatus(true);
      const { data, error } = await supabase.functions.invoke("check-connect-status");
      if (error) throw error;
      if (data) {
        setConnectDetails(data);
        if (data.status && data.status !== connectStatus) {
          setConnectStatus(data.status);
          if (data.status === "active") {
            toast({ title: "Account Active!", description: "Your Stripe account is now fully verified." });
          }
        }
      }
    } catch (error) {
      console.error("Error checking connect status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectAccount = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("create-connect-account");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast({ title: "Opening Stripe Connect", description: "Complete the onboarding in the new tab" });
      }
    } catch (error) {
      console.error("Error connecting account:", error);
      toast({ title: "Connection Failed", description: "Unable to connect Stripe account.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManageAccount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-login-link");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating login link:", error);
      toast({ title: "Error", description: "Failed to open Stripe dashboard", variant: "destructive" });
    }
  };

  // --- Wallet logic ---
  const fetchWallet = async () => {
    if (!user) return;
    const { data: wallet } = await supabase
      .from("wallets")
      .select("user_id, balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (wallet) {
      setWalletBalance(wallet.balance || 0);
    }

    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, type, amount, description, created_at, status, related_project_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (transactions) setRecentTransactions(transactions);
  };

  const handleTopUpSuccess = () => {
    fetchWallet();
    fetchAccountStatus();
  };

  const handleTransferComplete = () => {
    fetchWallet();
  };

  if (loading) {
    return (
      <StudioFeatureShell>
        <Skeleton className="h-8 sm:h-12 w-48 sm:w-64" />
        <div className="grid gap-3 grid-cols-2">
          <Skeleton className="h-20 sm:h-32 col-span-2 sm:col-span-1" />
          <Skeleton className="h-20 sm:h-32" />
          <Skeleton className="h-20 sm:h-32" />
        </div>
      </StudioFeatureShell>
    );
  }

  return (
    <>
      <SEO
        title="KrePay — Wallet & Payments"
        description="Manage your wallet, earnings, status, and payment account"
      />

      <FeaturePageHeader
        eyebrow="Your money, daily"
        title="KrePay."
        accentTitle="Without the spreadsheet."
        subtitle={
          isBrand
            ? "Everything about paying the creators you hire, in one place."
            : "Everything about getting paid for your creative work, in one place."
        }
        tutorial={
          isBrand
            ? { featureKey: "krepay-brand", label: "How KrePay works for Brands", steps: KREPAY_BRAND_TUTORIAL }
            : { featureKey: "krepay", label: "How KrePay works", steps: KREPAY_TUTORIAL }
        }
        tabs={
          <div className="flex items-center gap-2">
            {/* Send Money — icon only */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              aria-label="Send money"
              onClick={() => setTransferDialogOpen(true)}
            >
              <Send className="h-4 w-4" />
            </Button>

            {/* Actions menu — Top Up / Invoice / Quote / Expense. Top Up
                used to be a standalone primary CTA here; demoted into this
                menu so the header emphasizes Get Paid / Activity / Payouts
                instead of a wallet-funding action most sessions don't need. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 w-9 p-0" aria-label="Actions">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
                <DropdownMenuLabel>Wallet</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTopUpDialogOpen(true)}>
                  <Wallet className="h-4 w-4 mr-2 text-primary" />
                  Top Up
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Create</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setActiveTab("earnings");
                    setTimeout(
                      () => window.dispatchEvent(new CustomEvent("thrivepay:create-document", { detail: { type: "invoice" } })),
                      80
                    );
                  }}
                >
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  New Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setActiveTab("earnings");
                    setTimeout(
                      () => window.dispatchEvent(new CustomEvent("thrivepay:create-document", { detail: { type: "quote" } })),
                      80
                    );
                  }}
                >
                  <FilePlus className="h-4 w-4 mr-2 text-primary" />
                  New Quote
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setActiveTab("earnings");
                    setTimeout(() => window.dispatchEvent(new CustomEvent("thrivepay:add-expense")), 80);
                  }}
                >
                  <Receipt className="h-4 w-4 mr-2 text-primary" />
                  New Expense
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="accent-pay min-h-screen">
      <StudioFeatureShell>
        <KretoTip compact />

        {/* Get Paid dashboard — the unified summary (metrics + trend chart
            + weekly insights) required by the overhaul spec, replacing the
            previous stack of separate, partly-redundant cards. */}
        <div className="mb-4 sm:mb-6">
          <KrePayDashboard />
        </div>

        {/* Linked bank accounts — Kretopia Wallet card owns the actionable
            "Add your bank" / "Cash out" balance and payout methods; kept
            distinct from the dashboard above so the balance is shown once,
            not twice. */}
        <div className="mb-6">
          <ThriveWalletCard />
        </div>

        {/* Thrive proactive nudges (Pay surface) */}
        <SurfaceProactiveCards surface="pay" className="px-0 mb-4 sm:mb-6" />

        {/* AI assistance — the one genuinely LLM-backed surface on this
            page; see KrePayAIInsights for what it does and doesn't do. */}
        <div className="mb-4 sm:mb-6">
          <KrePayAIInsights />
        </div>

        <WalletTopUpDialog open={topUpDialogOpen} onOpenChange={setTopUpDialogOpen} />
        <WalletTransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          walletBalance={walletBalance}
          onTransferComplete={handleTransferComplete}
        />

        {/* ───── Command center: 3 tabbed panels instead of one long
            scroll ─────
            Everything above (identity strip, Kreto tip, wallet card,
            proactive nudges, balance overview) is the always-visible
            summary — the numbers a user needs at a glance stay on screen
            regardless of which tab is open below. The 5 sections that used
            to stack in one continuous scroll (Payment Links, Invoices &
            Earnings, Recent Activity, Payouts, Fees) are grouped into 3
            panels by the question they answer, switched by tab instead of
            scrolled past: "Get Paid" (act now), "Activity" (what
            happened), "Payouts & Fees" (how money leaves the platform to
            you). Every section's own internal logic/handlers are
            unchanged — this is a layout regrouping, not a rewrite. */}
        <Tabs defaultValue="get-paid" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3 h-auto p-1 rounded-xl bg-card/80 border border-border/60 backdrop-blur-sm">
            <TabsTrigger value="get-paid" className="gap-1.5 py-2 text-xs sm:text-sm">
              <Send className="h-3.5 w-3.5" /> Get Paid
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 py-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-1.5 py-2 text-xs sm:text-sm">
              <CreditCard className="h-3.5 w-3.5" /> Payouts & Fees
            </TabsTrigger>
          </TabsList>

          {/* 1. Get Paid — Payment Links */}
          <TabsContent value="get-paid" className="mt-0">
            <section>
              <PaymentLinksSection />
            </section>
          </TabsContent>

          {/* 2. Activity — Invoices & Earnings + Recent Activity */}
          <TabsContent value="activity" className="mt-0 space-y-6">
        {/* Scan-a-receipt — contextual to Activity (where expenses live)
            instead of floating globally over every tab, per the overhaul
            spec's "misplaced Scan button." */}
        <SnapReceiptFAB />
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Invoices & Earnings
          </h2>
          <FreeTierGate
            feature="expenses"
            featureLabel="Creative Earnings"
            description="Upgrade to Pro for unlimited expense tracking, invoicing, and earnings insights."
          >
            <AccountingDashboard />
          </FreeTierGate>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Recent Activity
            </h2>
            <Button variant="link" size="sm" onClick={() => navigate("/payment-history")}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <Card className="rounded-2xl border-border/60 shadow-none">
                <EmptyState
                  icon={Wallet}
                  eyebrow="Your creative finances"
                  title="Ready to get paid"
                  description="Send your first invoice or share a payment link — your creative finances start here."
                  action={{
                    label: "Create Invoice",
                    icon: Plus,
                    onClick: () => window.dispatchEvent(new CustomEvent("thrivepay:create-document", { detail: { type: "invoice" } })),
                  }}
                />
              </Card>
            ) : (
              recentTransactions.map((tx) => {
                const isIn = tx.type.includes("earned") || tx.type.includes("received");
                return (
                  <Card
                    key={tx.id}
                    className="rounded-xl border-border/60 shadow-none hover:bg-accent/5 transition-smooth cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTransaction(tx as TransactionDetail)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedTransaction(tx as TransactionDetail)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className={`rounded-full p-1.5 sm:p-2 flex-shrink-0 ${isIn ? "bg-success/10" : "bg-destructive/10"}`}>
                            {isIn ? <ArrowDownRight className="h-4 w-4 text-success" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`text-sm sm:text-lg font-semibold flex-shrink-0 ${isIn ? "text-success" : "text-destructive"}`}>
                          {isIn ? "+" : "-"}${tx.amount}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </section>
          </TabsContent>

          {/* 3. Payouts & Fees — Stripe Connect + fee rate */}
          <TabsContent value="payouts" className="mt-0 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Payouts to your bank
          </h2>

          {connectStatus === "not_connected" && (
            <Card className="rounded-2xl border-border/60 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" />
                  Connect your bank — no Stripe account needed
                </CardTitle>
                <CardDescription>
                  Kretopia Wallet handles the heavy lifting. You won't manage a Stripe dashboard — just add your bank and get paid.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {[
                    { icon: CheckCircle, title: "Secure & Compliant", desc: "Bank-grade security" },
                    { icon: Zap, title: "Fast Payouts", desc: "Direct to your bank" },
                    { icon: DollarSign, title: "No Liability", desc: "Kretopia never holds funds" },
                  ].map((f) => (
                    <div key={f.title} className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-0.5 text-sm">{f.title}</h3>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleConnectAccount} className="w-full" size="lg">
                  <ExternalLink className="mr-2 h-4 w-4" /> Set up payouts
                </Button>
              </CardContent>
            </Card>
          )}

          {(connectStatus === "pending" || connectStatus === "restricted") && (
            <Card className="rounded-2xl border-warning/30 bg-warning/5 shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-warning text-base">
                    {connectStatus === "restricted" ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    {connectStatus === "restricted" ? "Action Required" : "Setup Incomplete"}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={checkConnectStatus} disabled={checkingStatus}>
                    {checkingStatus ? "Checking..." : "Refresh"}
                  </Button>
                </div>
                <CardDescription>
                  {connectStatus === "restricted"
                    ? "Your account has restrictions. Complete the items below."
                    : "Complete onboarding to start receiving payouts."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Details Submitted", ok: connectDetails?.detailsSubmitted },
                    { label: "Charges Enabled", ok: connectDetails?.chargesEnabled },
                    { label: "Payouts Enabled", ok: connectDetails?.payoutsEnabled },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-2 rounded-lg border p-3 ${item.ok ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
                      {item.ok ? <CheckCircle className="h-4 w-4 text-success flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />}
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
                {connectDetails?.requirements && connectDetails.requirements.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Missing Information:</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {connectDetails.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={handleConnectAccount} size="lg" className="w-full sm:w-auto">
                  <ExternalLink className="mr-2 h-4 w-4" /> Complete Setup
                </Button>
              </CardContent>
            </Card>
          )}

          {connectStatus === "active" && (
            <Card className="rounded-2xl border-border/60 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Payouts active</CardTitle>
                <CardDescription>Your bank is connected. Stripe transfers your balance automatically.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button onClick={handleManageAccount} variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" /> Payout settings
                </Button>
                <Button onClick={fetchAccountStatus} variant="outline" size="sm">Refresh Balance</Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Sandbox manual-SEPA extension — separate from the wallet payout
            setup above: that's how Kretopia pays you, this is how a client
            can pay you directly for one invoice, bypassing the wallet. */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" /> Bank transfer for invoices
          </h2>
          <InvoiceSepaBeneficiaryCard />
        </section>

        {/* Trust & controls */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Trust & security
          </h2>
          <TrustControlsCard />
        </section>

        {/* 5. Fees */}
        <section className="mb-6 space-y-3">
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" /> Your fee rate
          </h2>
          <Card className="rounded-2xl border-border/60 shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-primary">{getFeeDisplayText(subscriptionTier)}</div>
                <p className="text-xs text-muted-foreground">per transaction · Stripe fees (~2.9% + 30¢) separate</p>
              </div>
              {subscriptionTier === "free" && (
                <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
                  Upgrade to Save
                </Button>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <FeeStructure currentTier={subscriptionTier} />
            <FeeCalculator subscriptionTier={subscriptionTier} />
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </StudioFeatureShell>
      </div>

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      />
    </>
  );
}
