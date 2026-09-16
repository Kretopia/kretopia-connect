import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, ShieldCheck, Settings, UserPlus, Send, Loader2, Leaf, CheckCircle, AlertCircle, Bot, Sparkles, Search, Megaphone, MessageSquare, Mail, Crown, Banknote, Activity, TrendingUp, type LucideIcon } from "lucide-react";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { ScoutFunnelTab } from "@/components/admin/ScoutFunnelTab";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UsersTab } from "@/components/admin/UsersTab";
import { VerificationTab } from "@/components/admin/VerificationTab";
import { UnclaimedProfilesTab } from "@/components/admin/UnclaimedProfilesTab";
import { OutreachTab } from "@/components/admin/OutreachTab";
import { FeedbackTab } from "@/components/admin/FeedbackTab";
import { DripCampaignTab } from "@/components/admin/DripCampaignTab";
import { FounderGrantTab } from "@/components/admin/FounderGrantTab";
import { BankTransfersTab } from "@/components/admin/BankTransfersTab";
import { BounceRateTab } from "@/components/admin/BounceRateTab";
import { AmbassadorsTab } from "@/components/admin/AmbassadorsTab";
import { ProductDashboardTab } from "@/components/admin/ProductDashboardTab";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OdosImportResult {
  name: string;
  status: 'imported' | 'enriched' | 'duplicate' | 'error';
  profileId?: string;
  credits?: number;
  awards?: number;
  message?: string;
}

interface OdosImportSummary {
  totalMembers: number;
  imported: number;
  enriched: number;
  duplicates: number;
  errors: number;
}

interface AIDiscoveryResult {
  name: string;
  status: 'imported' | 'duplicate' | 'skipped' | 'error';
  role?: string;
  error?: string;
  enriched?: boolean;
}

interface AIDiscoverySummary {
  discovered: number;
  processed: number;
  imported: number;
  enriched: number;
  duplicates: number;
  errors: number;
}

interface AdminTabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface AdminTabGroup {
  label: string;
  tabs: AdminTabDef[];
}

const TAB_GROUPS: AdminTabGroup[] = [
  {
    label: "Users & Trust",
    tabs: [
      { value: "users", label: "Users", icon: Users },
      { value: "unclaimed", label: "Unclaimed", icon: UserPlus },
      { value: "verifications", label: "Verify", icon: ShieldCheck },
    ],
  },
  {
    label: "Growth",
    tabs: [
      { value: "feedback", label: "Feedback", icon: MessageSquare },
      { value: "outreach", label: "Outreach", icon: Megaphone },
      { value: "drip", label: "Drip", icon: Mail },
      { value: "ambassadors", label: "Ambassadors", icon: Megaphone },
      { value: "scout-funnel", label: "Scout Funnel", icon: TrendingUp },
    ],
  },
  {
    label: "Finance",
    tabs: [
      { value: "founder", label: "Founder", icon: Crown },
      { value: "bank-transfers", label: "Transfers", icon: Banknote },
    ],
  },
  {
    label: "Product & Analytics",
    tabs: [
      { value: "product", label: "Product", icon: Sparkles },
      { value: "analytics", label: "Hosting", icon: Activity },
    ],
  },
  {
    label: "System",
    tabs: [{ value: "system", label: "System", icon: Settings }],
  },
];

interface AdminOverview {
  totalUsers: number;
  pendingVerifications: number;
  unclaimedProfiles: number;
  pendingTransfers: number;
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastCta, setBroadcastCta] = useState('Check It Out →');
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState('https://www.kretopia.com');
  const [importingOdos, setImportingOdos] = useState(false);
  const [odosResults, setOdosResults] = useState<OdosImportResult[] | null>(null);
  const [odosSummary, setOdosSummary] = useState<OdosImportSummary | null>(null);
  
  // AI Discovery state
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<AIDiscoveryResult[] | null>(null);
  const [discoverySummary, setDiscoverySummary] = useState<AIDiscoverySummary | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminAccess();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    (async () => {
      setOverviewLoading(true);
      setOverviewError(false);
      try {
        const [usersRes, verifRes, unclaimedRes, transfersRes] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_claimed", false),
          supabase.from("manual_bank_transfers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        if (cancelled) return;

        if (usersRes.error || verifRes.error || unclaimedRes.error || transfersRes.error) {
          setOverviewError(true);
          return;
        }

        setOverview({
          totalUsers: usersRes.count ?? 0,
          pendingVerifications: verifRes.count ?? 0,
          unclaimedProfiles: unclaimedRes.count ?? 0,
          pendingTransfers: transfersRes.count ?? 0,
        });
      } catch {
        if (!cancelled) setOverviewError(true);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to verify admin access",
          variant: "destructive",
        });
        navigate("/circle");
        return;
      }

      if (!data) {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate("/circle");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while checking permissions",
        variant: "destructive",
      });
      navigate("/circle");
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcastEmail = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      toast({ title: "Missing fields", description: "Subject and body are required", variant: "destructive" });
      return;
    }
    setSendingBroadcast(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast-email', {
        body: {
          subject: broadcastSubject,
          body: broadcastBody,
          ctaText: broadcastCta,
          ctaUrl: broadcastCtaUrl,
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Broadcast Sent!",
        description: `Successfully sent to ${data?.sent || 0} users. ${data?.failed || 0} failed.`,
      });
      setBroadcastSubject('');
      setBroadcastBody('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send broadcast email",
        variant: "destructive",
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const importOdosMembers = async () => {
    setImportingOdos(true);
    setOdosResults(null);
    setOdosSummary(null);
    
    try {
      toast({
        title: "ODOS Import Started",
        description: "Scraping members and enriching with AI... This may take a few minutes.",
      });

      const { data, error } = await supabase.functions.invoke('import-odos-members');
      
      if (error) throw error;
      
      if (data?.results) {
        setOdosResults(data.results);
        setOdosSummary(data.summary);
      }
      
      toast({
        title: "ODOS Import Complete! 🌿",
        description: `Imported ${data?.summary?.imported || 0} members, ${data?.summary?.enriched || 0} enriched with credits/awards.`,
      });
    } catch (error: any) {
      console.error("ODOS import error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to import ODOS members",
        variant: "destructive",
      });
    } finally {
      setImportingOdos(false);
    }
  };

  const runAIDiscovery = async (maxProfiles = 20) => {
    setRunningDiscovery(true);
    setDiscoveryResults(null);
    setDiscoverySummary(null);
    
    try {
      toast({
        title: "AI Discovery Agent Started",
        description: "Searching for authentic creatives across the web... This may take a few minutes.",
      });

      const { data, error } = await supabase.functions.invoke('auto-discover-creatives', {
        body: { maxProfiles },
      });
      
      if (error) throw error;
      
      if (data?.results) {
        setDiscoveryResults(data.results);
        setDiscoverySummary(data.summary);
      }
      
      toast({
        title: "AI Discovery Complete!",
        description: `Discovered ${data?.summary?.discovered || 0} creatives, imported ${data?.summary?.imported || 0} new profiles.`,
      });
    } catch (error: any) {
      console.error("AI Discovery error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to run AI discovery",
        variant: "destructive",
      });
    } finally {
      setRunningDiscovery(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const overviewCards: { key: keyof AdminOverview; label: string; icon: LucideIcon; jumpTo: string }[] = [
    { key: "totalUsers", label: "Total users", icon: Users, jumpTo: "users" },
    { key: "pendingVerifications", label: "Pending verifications", icon: ShieldCheck, jumpTo: "verifications" },
    { key: "unclaimedProfiles", label: "Unclaimed profiles", icon: UserPlus, jumpTo: "unclaimed" },
    { key: "pendingTransfers", label: "Pending transfers", icon: Banknote, jumpTo: "bank-transfers" },
  ];

  return (
    <div className="pb-24">
      <FeaturePageHeader
        eyebrow="Admin"
        title="Operations."
        accentTitle="Everything running Kretopia."
        subtitle="System health, moderation, and growth — one control surface for the team."
      />

      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-4 sm:pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5 sm:mb-6">
          {overviewCards.map(({ key, label, icon: Icon, jumpTo }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(jumpTo)}
              disabled={overviewError}
              className="text-left rounded-2xl border border-border/60 bg-card px-3.5 py-3 transition-colors hover:border-energy/40 hover:bg-energy/[0.03] disabled:cursor-default disabled:hover:border-border/60 disabled:hover:bg-card"
            >
              <Icon className="h-4 w-4 text-energy mb-2" />
              {overviewLoading ? (
                <div className="h-6 w-10 rounded bg-muted animate-pulse" aria-hidden />
              ) : overviewError ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <p className="text-xl font-black tracking-tight">{overview?.[key] ?? 0}</p>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
                {label}
              </p>
            </button>
          ))}
        </div>
        {overviewError && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Couldn't load the overview counts — the tabs below still work.
          </p>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto w-full flex-col items-stretch gap-3 bg-transparent p-0">
            {TAB_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tabs.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex-shrink-0 gap-1.5 rounded-full border border-border/60 px-3 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </TabsTrigger>
                  ))}
                </div>
              </div>
            ))}
          </TabsList>

        <TabsContent value="users" className="mt-4 sm:mt-6">
          <UsersTab />
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 sm:mt-6">
          <FeedbackTab />
        </TabsContent>

        <TabsContent value="unclaimed" className="mt-4 sm:mt-6">
          <UnclaimedProfilesTab />
        </TabsContent>

        <TabsContent value="outreach" className="mt-4 sm:mt-6">
          <OutreachTab />
        </TabsContent>

        <TabsContent value="verifications" className="mt-4 sm:mt-6">
          <VerificationTab />
        </TabsContent>

        <TabsContent value="drip" className="mt-4 sm:mt-6">
          <DripCampaignTab />
        </TabsContent>

        <TabsContent value="founder" className="mt-4 sm:mt-6">
          <FounderGrantTab />
        </TabsContent>

        <TabsContent value="bank-transfers" className="mt-4 sm:mt-6">
          <BankTransfersTab />
        </TabsContent>

        <TabsContent value="ambassadors" className="mt-4 sm:mt-6">
          <AmbassadorsTab />
        </TabsContent>

        <TabsContent value="product" className="mt-4 sm:mt-6">
          <ProductDashboardTab />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 sm:mt-6">
          <BounceRateTab />
        </TabsContent>

        <TabsContent value="scout-funnel" className="mt-4 sm:mt-6">
          <ScoutFunnelTab />
        </TabsContent>

        <TabsContent value="system" className="mt-4 sm:mt-6">
          <div className="space-y-6">
            {/* ODOS Import Card */}
            <Card className="rounded-2xl border-success/30 bg-success/5 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <Leaf className="h-5 w-5" />
                  ODOS Community Import
                </CardTitle>
                <CardDescription>
                  Scrape ODOS members page, enrich profiles with AI (IMDb, Wikipedia, etc.), and tag with ODOS badge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={importOdosMembers}
                  disabled={importingOdos}
                  className="w-full sm:w-auto bg-success hover:bg-success/90 text-success-foreground"
                >
                  {importingOdos ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importing ODOS Members...
                    </>
                  ) : (
                    <>
                      <Leaf className="h-4 w-4 mr-2" />
                      Import ODOS Members
                    </>
                  )}
                </Button>

                {/* Summary */}
                {odosSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                    <div className="bg-muted p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold">{odosSummary.totalMembers}</div>
                      <div className="text-xs text-muted-foreground">Total Found</div>
                    </div>
                    <div className="bg-success/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-success">{odosSummary.imported}</div>
                      <div className="text-xs text-muted-foreground">Imported</div>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-primary">{odosSummary.enriched}</div>
                      <div className="text-xs text-muted-foreground">Enriched</div>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-warning">{odosSummary.duplicates}</div>
                      <div className="text-xs text-muted-foreground">Duplicates</div>
                    </div>
                    <div className="bg-destructive/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-destructive">{odosSummary.errors}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>
                )}

                {/* Results List */}
                {odosResults && odosResults.length > 0 && (
                  <ScrollArea className="h-64 border border-border/60 rounded-xl p-2">
                    <div className="space-y-2">
                      {odosResults.map((result, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {result.status === 'enriched' && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                            {result.status === 'imported' && (
                              <CheckCircle className="h-4 w-4 text-success" />
                            )}
                            {result.status === 'duplicate' && (
                              <AlertCircle className="h-4 w-4 text-warning" />
                            )}
                            {result.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="text-sm font-medium">{result.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.credits && result.credits > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {result.credits} credits
                              </Badge>
                            )}
                            {result.awards && result.awards > 0 && (
                              <Badge variant="secondary" className="text-xs bg-warning/20">
                                {result.awards} awards
                              </Badge>
                            )}
                            <Badge
                              variant={result.status === 'error' ? 'destructive' : 'outline'}
                              className={
                                result.status === 'enriched' ? 'bg-primary/20 text-primary' :
                                result.status === 'imported' ? 'bg-success/20 text-success' :
                                result.status === 'duplicate' ? 'bg-warning/20 text-warning' :
                                ''
                              }
                            >
                              {result.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* AI Discovery Agent Card */}
            <Card className="rounded-2xl border-primary/30 bg-primary/5 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Bot className="h-5 w-5" />
                  AI Creative Discovery Agent
                </CardTitle>
                <CardDescription>
                  Autonomous AI that discovers authentic creatives from industry news, award shows, and platforms (runs twice daily automatically)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={() => runAIDiscovery(10)} 
                    disabled={runningDiscovery}
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10"
                  >
                    {runningDiscovery ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Discovering...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Quick Run (10)
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => runAIDiscovery(20)}
                    disabled={runningDiscovery}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {runningDiscovery ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Discovering...
                      </>
                    ) : (
                      <>
                        <Bot className="h-4 w-4 mr-2" />
                        Standard Run (20)
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => runAIDiscovery(50)} 
                    disabled={runningDiscovery}
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10"
                  >
                    {runningDiscovery ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Discovering...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Deep Run (50)
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Discovery Sources:</p>
                  <p>• Industry News (Billboard, Variety, Hollywood Reporter)</p>
                  <p>• Award Shows (Grammy, Oscar, Emmy nominees)</p>
                  <p>• Platforms (IMDb, Spotify, Behance, Dribbble)</p>
                  <p>• Trending Creatives & Breakout Artists</p>
                </div>

                {/* Summary */}
                {discoverySummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4">
                    <div className="bg-muted p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold">{discoverySummary.discovered}</div>
                      <div className="text-xs text-muted-foreground">Discovered</div>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-primary">{discoverySummary.processed}</div>
                      <div className="text-xs text-muted-foreground">Processed</div>
                    </div>
                    <div className="bg-success/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-success">{discoverySummary.imported}</div>
                      <div className="text-xs text-muted-foreground">Imported</div>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-primary">{discoverySummary.enriched}</div>
                      <div className="text-xs text-muted-foreground">Enriched</div>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-warning">{discoverySummary.duplicates}</div>
                      <div className="text-xs text-muted-foreground">Duplicates</div>
                    </div>
                    <div className="bg-destructive/10 p-3 rounded-xl text-center">
                      <div className="text-2xl font-bold text-destructive">{discoverySummary.errors}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>
                )}

                {/* Results List */}
                {discoveryResults && discoveryResults.length > 0 && (
                  <ScrollArea className="h-64 border border-border/60 rounded-xl p-2">
                    <div className="space-y-2">
                      {discoveryResults.map((result, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {result.status === 'imported' && (
                              <CheckCircle className="h-4 w-4 text-success" />
                            )}
                            {result.status === 'duplicate' && (
                              <AlertCircle className="h-4 w-4 text-warning" />
                            )}
                            {result.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                            <div>
                              <span className="text-sm font-medium">{result.name}</span>
                              {result.role && (
                                <span className="text-xs text-muted-foreground ml-2">({result.role})</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.enriched && (
                              <Badge variant="secondary" className="text-xs bg-primary/20">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Enriched
                              </Badge>
                            )}
                            <Badge
                              variant={result.status === 'error' ? 'destructive' : 'outline'}
                              className={
                                result.status === 'imported' ? 'bg-success/20 text-success' :
                                result.status === 'duplicate' ? 'bg-warning/20 text-warning' :
                                ''
                              }
                            >
                              {result.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Weekly Founder Note Card */}
            <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Weekly Founder Note (Monday Drop)
                </CardTitle>
                <CardDescription>
                  Write your personal Sunday note that ships in Monday's digest. Reminder email arrives Sun 6 PM UTC.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/admin/weekly-note')} className="w-full sm:w-auto">
                  <Mail className="h-4 w-4 mr-2" />
                  Open weekly note editor
                </Button>
              </CardContent>
            </Card>

            {/* Broadcast Email Card */}
            <Card className="rounded-2xl border-border/60 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Broadcast Email
                </CardTitle>
                <CardDescription>
                  Compose and send a custom email to all users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="broadcast-subject">Subject Line</Label>
                  <Input
                    id="broadcast-subject"
                    placeholder="e.g. 🚀 New Features on Kretopia"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="broadcast-body">Email Body</Label>
                  <Textarea
                    id="broadcast-body"
                    placeholder="Write your message here. Use line breaks for paragraphs. Each user will be greeted by name automatically."
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-cta">Button Text</Label>
                    <Input
                      id="broadcast-cta"
                      placeholder="Check It Out →"
                      value={broadcastCta}
                      onChange={(e) => setBroadcastCta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-cta-url">Button URL</Label>
                    <Input
                      id="broadcast-cta-url"
                      placeholder="https://www.kretopia.com"
                      value={broadcastCtaUrl}
                      onChange={(e) => setBroadcastCtaUrl(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={sendBroadcastEmail} 
                  disabled={sendingBroadcast || !broadcastSubject.trim() || !broadcastBody.trim()}
                  className="w-full sm:w-auto"
                >
                  {sendingBroadcast ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending to all users...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Broadcast
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
