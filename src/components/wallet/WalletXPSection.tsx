import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Snowflake, Crown, Eye, Sparkles, Zap, Star, Gift, Search,
  Image, Briefcase, BarChart3, MessageSquare, FileText,
} from "lucide-react";
// Reputation is calculated from Standing (src/lib/passport/standing.ts)

interface SearchedUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

export function WalletXPSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userXP, setUserXP] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [freezeCount, setFreezeCount] = useState(0);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);

  useEffect(() => {
    if (user) fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("xp, level, streak_freeze_count")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setUserXP(data.xp || 0);
      setUserLevel(data.level || 1);
      setFreezeCount(data.streak_freeze_count || 0);
    }
  };

  const deductXP = async (amount: number, purpose: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc("spend_xp" as any, { p_amount: amount, p_purpose: purpose });
    if (error) {
      toast({ title: "Not enough Thrive Points", description: error.message, variant: "destructive" });
      return false;
    }
    setUserXP((prev) => prev - amount);
    return true;
  };

  const getMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
  };

  /** Add bonus uses to a feature's localStorage cap for the current month */
  const addBonusUses = (feature: string, bonusCount: number) => {
    if (!user) return;
    const key = `thrivein_bonus_${user.id}_${feature}`;
    try {
      const stored = localStorage.getItem(key);
      let current = 0;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.month === getMonthKey()) current = parsed.count || 0;
      }
      localStorage.setItem(key, JSON.stringify({ month: getMonthKey(), count: current + bonusCount }));
    } catch { /* ignore */ }
  };

  // Actions
  const buyStreakFreeze = async () => {
    if (!user) return;
    if (await deductXP(500, "streak_freeze")) setFreezeCount((prev) => prev + 1);
  };

  const buyProfileBoost = async () => {
    await deductXP(1000, "profile_boost");
  };

  const buyDoubleXP = async () => {
    await deductXP(750, "double_xp");
  };

  const buyProTrial = async () => {
    if (!user) return;
    await deductXP(2500, "pro_trial");
  };

  const buyExtraWorkCredits = async () => {
    if (await deductXP(400, "extra_work_credits")) addBonusUses("workCredits", 5);
  };

  const buyExtraAIBriefs = async () => {
    if (await deductXP(800, "extra_briefs")) addBonusUses("aiBriefs", 5);
  };

  const buyExtraInvoices = async () => {
    if (await deductXP(300, "extra_invoices")) addBonusUses("invoices", 3);
  };

  const buyPriorityGig = async () => {
    if (await deductXP(1500, "priority_gig")) addBonusUses("priority_gig", 1);
  };

  const buyAnalyticsReport = async () => {
    if (await deductXP(2000, "analytics_report")) addBonusUses("analytics_report", 1);
  };

  // Gift XP
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !user) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .neq("user_id", user.id)
        .ilike("full_name", `%${query}%`)
        .limit(8);
      setSearchResults(data || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const sendGiftXP = async (recipient: SearchedUser) => {
    if (!user) return;
    if (userXP < 150) {
      toast({ title: "Not enough Thrive Points", description: "You need 150 TP to gift.", variant: "destructive" });
      return;
    }
    setSendingGift(true);
    try {
      const { error: spendError } = await supabase.rpc("spend_xp" as any, { p_amount: 150, p_purpose: "gift_xp_sent" });
      if (spendError) throw spendError;
      await supabase.rpc("award_xp" as any, { p_user_id: recipient.user_id, p_amount: 100, p_reason: "gift_xp_received" });
      toast({ title: "Gift Sent! 🎁", description: `You sent 100 Thrive Points to ${recipient.full_name}` });
      setGiftDialogOpen(false);
      setSearchQuery("");
      await fetchUserData();
    } catch { toast({ title: "Gift Failed", variant: "destructive" }); }
    finally { setSendingGift(false); }
  };

  const purchaseItem = async (item: typeof shopItems[0]) => {
    if (userXP < item.cost) {
      toast({ title: "Not enough Thrive Points", description: `You need ${item.cost - userXP} more TP.`, variant: "destructive" });
      return;
    }
    if (item.id === "gift_xp") { setGiftDialogOpen(true); return; }
    setPurchasing(item.id);
    try {
      await item.action();
      toast({ title: "Purchase Complete!", description: `You got ${item.name}!` });
      await fetchUserData();
    } catch { toast({ title: "Purchase Failed", variant: "destructive" }); }
    finally { setPurchasing(null); }
  };

  const shopItems = [
    { id: "streak_freeze", name: "Streak Freeze", description: `Protect your streak. You have ${freezeCount}.`, cost: 500, icon: <Snowflake className="h-5 w-5 text-primary" />, action: buyStreakFreeze, available: true },
    { id: "profile_boost", name: "24h Profile Boost", description: "Top of Discover for 24 hours.", cost: 1000, icon: <Eye className="h-5 w-5 text-amber-400" />, action: buyProfileBoost, available: true },
    { id: "double_xp", name: "2x Points (24 hours)", description: "Double points on all activities.", cost: 750, icon: <Zap className="h-5 w-5 text-yellow-400" />, action: buyDoubleXP, available: true },
    { id: "extra_work_credits", name: "+5 Work Credits", description: "Add 5 more work credits this month.", cost: 400, icon: <Image className="h-5 w-5 text-emerald-400" />, action: buyExtraWorkCredits, available: true, badge: "Popular" },
    { id: "extra_briefs", name: "+5 Smart Briefs", description: "5 extra Smart Briefs this month.", cost: 800, icon: <Search className="h-5 w-5 text-primary" />, action: buyExtraAIBriefs, available: true },
    { id: "extra_invoices", name: "+3 Invoices", description: "3 extra invoices this month.", cost: 300, icon: <FileText className="h-5 w-5 text-teal-400" />, action: buyExtraInvoices, available: true },
    { id: "priority_gig", name: "Priority Gig Listing", description: "Pin your opportunity for 24h.", cost: 1500, icon: <Briefcase className="h-5 w-5 text-orange-400" />, action: buyPriorityGig, available: true },
    { id: "analytics_unlock", name: "Analytics Report", description: "Full profile analytics export (1x).", cost: 2000, icon: <BarChart3 className="h-5 w-5 text-primary" />, action: buyAnalyticsReport, available: true },
    { id: "pro_trial", name: "Pro Trial (3 Days)", description: "Unlock all Pro features.", cost: 2500, icon: <Crown className="h-5 w-5 text-primary" />, action: buyProTrial, available: true, badge: "Best Value" },
    { id: "gift_xp", name: "Gift 100 TP", description: "Send 100 Thrive Points to another creator.", cost: 150, icon: <Gift className="h-5 w-5 text-green-400" />, action: async () => {}, available: true },
  ];

  const nextLevelXP = (userLevel) * (userLevel) * 100;
  const progress = Math.min(100, (userXP / nextLevelXP) * 100);

  return (
    <div className="space-y-6">
      {/* Thrive Points Balance Card */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-scout">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Thrive Points</p>
              <p className="text-3xl font-bold">{userXP.toLocaleString()} TP</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className="bg-primary text-primary-foreground border-0">
              {userXP.toLocaleString()} TP
            </Badge>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress to Level {userLevel + 1}</span>
            <span>{userXP} / {nextLevelXP} TP</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </Card>

      {/* How to Earn */}
      <Card className="p-4 border-dashed">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" /> Ways to Earn Points
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { label: "Daily Login", xp: "+10" },
            { label: "Streak Bonus", xp: "+25" },
            { label: "New Connection", xp: "+25" },
            { label: "Complete Profile", xp: "+100" },
            { label: "Post Work", xp: "+30" },
            { label: "Get Reviewed", xp: "+150" },
            { label: "Project Done", xp: "+500" },
            { label: "Invite Accepted", xp: "+50 + Tier" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-bold text-primary">{item.xp}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rewards Shop Items */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" /> Spend Your Points
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {shopItems.map(item => (
            <Card key={item.id} className={`p-4 transition-all hover:shadow-md ${!item.available ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted/50 flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {"badge" in item && item.badge && (
                      <Badge variant="default" className="text-[10px]">{item.badge}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      {item.cost.toLocaleString()} TP
                    </span>
                    <Button
                      size="sm"
                      disabled={!item.available || userXP < item.cost || purchasing === item.id}
                      onClick={() => purchaseItem(item)}
                      className="text-xs"
                    >
                      {purchasing === item.id ? "..." : userXP < item.cost ? "Need more TP" : item.id === "gift_xp" ? "Send Gift" : "Buy"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Gift XP Dialog */}
      <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              Gift 100 Thrive Points
            </DialogTitle>
            <DialogDescription>
              Search for a creator to send 100 TP to (costs you 150 TP)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {searching && <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No creators found</p>
              )}
              {searchResults.map((person) => (
                <div key={person.user_id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={person.avatar_url || undefined} />
                      <AvatarFallback>{person.full_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{person.full_name}</p>
                      <p className="text-xs text-muted-foreground">{person.role}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => sendGiftXP(person)} disabled={sendingGift}>
                    {sendingGift ? "..." : "Gift"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
