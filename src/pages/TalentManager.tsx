import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { APP_URL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Users, DollarSign, Link2, TrendingUp, Loader2, Briefcase, ShieldCheck, ArrowRight, Plus } from "lucide-react";
import { SEO } from "@/components/SEO";

interface ManagerData {
  id: string;
  referral_code: string;
  commission_rate: number;
  display_name: string | null;
  organization: string | null;
  total_referred: number;
  total_earned: number;
  is_active: boolean;
}

interface ReferralData {
  id: string;
  talent_user_id: string;
  referred_at: string;
  status: string;
}

interface CommissionData {
  id: string;
  gross_amount: number;
  commission_amount: number;
  commission_rate: number;
  source_type: string;
  status: string;
  currency: string;
  created_at: string;
}

export default function TalentManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [commissions, setCommissions] = useState<CommissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [customCode, setCustomCode] = useState("");

  useEffect(() => {
    if (user) fetchManagerData();
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;

  const fetchManagerData = async () => {
    try {
      const { data: managerData } = await supabase
        .from("talent_managers")
        .select("*")
        .eq("manager_user_id", user!.id)
        .maybeSingle();

      if (managerData) {
        setManager(managerData as ManagerData);

        const [refResult, commResult] = await Promise.all([
          supabase
            .from("talent_referrals")
            .select("*")
            .eq("manager_id", managerData.id)
            .order("referred_at", { ascending: false }),
          supabase
            .from("referral_commissions")
            .select("*")
            .eq("manager_id", managerData.id)
            .order("created_at", { ascending: false }),
        ]);

        setReferrals((refResult.data || []) as ReferralData[]);
        setCommissions((commResult.data || []) as CommissionData[]);
      }
    } catch (error) {
      console.error("Error fetching manager data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    if (customCode) return customCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return "MGR" + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createManagerProfile = async () => {
    setCreating(true);
    try {
      const code = generateCode();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .single();

      const { error } = await supabase.from("talent_managers").insert({
        manager_user_id: user!.id,
        referral_code: code,
        display_name: profile?.full_name || null,
        commission_rate: 10,
      });

      if (error) throw error;

      // Enable manager mode on profile
      await supabase
        .from("profiles")
        .update({ is_manager_mode: true })
        .eq("user_id", user!.id);

      toast.success("Manager profile created!");
      fetchManagerData();
    } catch (error: any) {
      if (error?.code === "23505") {
        toast.error("That referral code is already taken. Try another.");
      } else {
        toast.error("Failed to create manager profile");
      }
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!manager) return;
    const link = `${APP_URL}/join/${manager.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  const totalEarned = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const pendingEarnings = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.commission_amount, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl pb-24 md:pb-6">
      <SEO title="Talent Manager | Kretopia" description="Manage your talent network, post jobs for clients, and earn commissions on bookings." />

      <div className="mb-6 space-y-3">
        <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
          Referral network
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">Talent Manager</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Manage your roster, post jobs for clients, and earn {manager?.commission_rate || 10}% on every booking.
        </p>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {!manager ? (
        <div className="space-y-6">
          {/* Revenue Protection Messaging */}
          <Card className="rounded-2xl shadow-none" style={{ borderColor: "hsl(var(--energy) / 0.3)", backgroundColor: "hsl(var(--energy) / 0.05)" }}>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <ShieldCheck className="h-8 w-8 shrink-0 mt-1" style={{ color: "hsl(var(--energy))" }} />
                <div className="space-y-2">
                  <h3 className="font-bold text-lg tracking-tight">Your revenue is protected</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Earn <strong className="text-foreground">10% ongoing commission</strong> on every job your talent completes — not a one-time bonus
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Your referral link <strong className="text-foreground">permanently connects</strong> talent to you — they can't be reassigned
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Post jobs on behalf of your clients and <strong className="text-foreground">manage everything from one dashboard</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Your talent gets access to <strong className="text-foreground">verified credits, portfolio, and more gig opportunities</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-none border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight">Activate Your Manager Dashboard</CardTitle>
              <CardDescription>
                Get your unique referral link. When talent signs up through your link and books gigs, you earn ongoing commission on every job.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Custom Referral Code (optional)</Label>
                <Input
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="e.g., TTPANETWORK"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">Leave blank for auto-generated code</p>
              </div>
              <Button onClick={createManagerProfile} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                Activate Manager Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardContent className="pt-6 text-center">
                <Users className="h-6 w-6 mx-auto mb-2" style={{ color: "hsl(var(--energy))" }} />
                <div className="text-2xl font-bold">{referrals.length}</div>
                <p className="text-xs text-muted-foreground">Talents Referred</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2" style={{ color: "hsl(var(--energy))" }} />
                <div className="text-2xl font-bold">${totalEarned.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2" style={{ color: "hsl(var(--energy))" }} />
                <div className="text-2xl font-bold">${pendingEarnings.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardContent className="pt-6 text-center">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {manager.commission_rate}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Commission Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl shadow-none border-border/60 cursor-pointer hover:border-[hsl(var(--energy)/0.4)] transition-colors" onClick={copyLink}>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0">
                  <Link2 className="h-6 w-6" style={{ color: "hsl(var(--energy))" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Share Referral Link</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    /join/{manager.referral_code}
                  </p>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
            <Card
              className="rounded-2xl shadow-none border-border/60 cursor-pointer hover:border-[hsl(var(--energy)/0.4)] transition-colors"
              onClick={() => navigate("/post-opportunity")}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0">
                  <Briefcase className="h-6 w-6" style={{ color: "hsl(var(--energy))" }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Post Job for Client</p>
                  <p className="text-xs text-muted-foreground">
                    List gigs on behalf of your clients
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </div>

          {/* Referral Link Details */}
          <Card className="rounded-2xl shadow-none border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
                <Link2 className="h-5 w-5" />
                Your Referral Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${APP_URL}/join/${manager.referral_code}`}
                  className="font-mono text-sm"
                />
                <Button onClick={copyLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this with your talent network. Anyone who signs up through this link is permanently connected to you, and you earn commission on every gig they book.
              </p>
            </CardContent>
          </Card>

          {/* Recent Commissions */}
          {commissions.length > 0 && (
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-bold tracking-tight">Recent Commissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commissions.slice(0, 10).map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div>
                        <p className="font-medium capitalize">{c.source_type} Booking</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()} · {c.commission_rate}% of ${c.gross_amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${c.commission_amount.toFixed(2)}</p>
                        <Badge variant={c.status === "paid" ? "default" : "secondary"} className="text-xs">
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Referred Talents */}
          {referrals.length > 0 && (
            <Card className="rounded-2xl shadow-none border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-bold tracking-tight">Your Talent Roster ({referrals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {referrals.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <p className="text-sm">Talent joined {new Date(r.referred_at).toLocaleDateString()}</p>
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Revenue Protection Info */}
          <Card className="rounded-2xl shadow-none" style={{ borderColor: "hsl(var(--energy) / 0.25)", backgroundColor: "hsl(var(--energy) / 0.05)" }}>
            <CardContent className="pt-6">
              <div className="flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--energy))" }} />
                <div>
                  <p className="font-medium text-sm mb-1">How your revenue is protected</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every talent who joins via your link is permanently attributed to you. You earn {manager.commission_rate}% on every gig they book — whether it's a job you posted or one they found themselves. Commissions are ongoing, not one-time. Your earnings grow as your roster grows.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
