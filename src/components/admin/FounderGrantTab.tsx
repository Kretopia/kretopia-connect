import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Search, Loader2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentSignup {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  subscription_tier: string | null;
  created_at: string;
}

export function FounderGrantTab() {
  const { toast } = useToast();
  const [signups, setSignups] = useState<RecentSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("Focus group attendee — April 2026");
  const [granting, setGranting] = useState(false);
  const [grantedThisSession, setGrantedThisSession] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecentSignups();
  }, []);

  const loadRecentSignups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role, subscription_tier, created_at")
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      setSignups((data as RecentSignup[]) || []);
    } catch (e: any) {
      toast({ title: "Failed to load signups", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelected(next);
  };

  const grantSelected = async () => {
    if (selected.size === 0) return;
    setGranting(true);
    let ok = 0;
    let fail = 0;
    for (const userId of Array.from(selected)) {
      const { error } = await supabase.rpc("admin_grant_founder_circle", {
        target_user_id: userId,
        grant_reason: reason || "Manual founder grant",
      });
      if (error) {
        console.error("Grant failed", userId, error);
        fail++;
      } else {
        ok++;
        setGrantedThisSession((prev) => new Set(prev).add(userId));
      }
    }
    setGranting(false);
    setSelected(new Set());
    toast({
      title: `Granted ${ok} founder spot${ok === 1 ? "" : "s"}`,
      description: fail > 0 ? `${fail} failed — check console.` : "All granted successfully.",
      variant: fail > 0 ? "destructive" : "default",
    });
    loadRecentSignups();
  };

  const filtered = signups.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.role?.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Grant Founder Circle
        </CardTitle>
        <CardDescription>
          Pick recent signups (focus group attendees, etc.) and grant them lifetime Founder Circle access. Logs who you granted and why.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={loadRecentSignups} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <Input
          placeholder="Reason / note (e.g. Focus group April 2026)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> selected of {filtered.length} shown
          </div>
          <Button
            onClick={grantSelected}
            disabled={selected.size === 0 || granting}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {granting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Granting…</>
            ) : (
              <><Crown className="h-4 w-4 mr-2" /> Grant Founder Circle</>
            )}
          </Button>
        </div>

        <ScrollArea className="h-[500px] border rounded-lg">
          <div className="divide-y">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No signups match.</div>
            ) : (
              filtered.map((s) => {
                const isFounder = s.subscription_tier === "founder" || grantedThisSession.has(s.user_id);
                return (
                  <label
                    key={s.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(s.user_id)}
                      onCheckedChange={() => toggleSelect(s.user_id)}
                      disabled={isFounder}
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={s.avatar_url || undefined} />
                      <AvatarFallback>{(s.full_name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{s.full_name || "(no name)"}</p>
                        {isFounder && (
                          <Badge className="bg-amber-500/15 text-amber-600 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Founder
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.role || "no role"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
