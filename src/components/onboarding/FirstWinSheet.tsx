import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, X, MapPin, ArrowRight } from "lucide-react";
import Confetti from "react-dom-confetti";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Match {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const confettiConfig = {
  angle: 90,
  spread: 200,
  startVelocity: 45,
  elementCount: 90,
  duration: 3500,
  colors: ["#7B61FF", "#C6FF00", "#a78bfa", "#10b981", "#f59e0b"],
};

/**
 * "First Win" celebration — shown once after onboarding completes.
 * Loads 3 real creators and lets the user connect or skip in one tap.
 * The dopamine hit: "you're already part of the scene."
 */
export function FirstWinSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setConfetti(false);
    const t = setTimeout(() => setConfetti(true), 250);

    (async () => {
      try {
        const { data: me } = await supabase
          .from("profiles")
          .select("role, location, professional_skills, primary_intents, primary_intent")
          .eq("user_id", user.id)
          .maybeSingle();

        const cityKey = (me?.location || "").split(",")[0].trim().toLowerCase();
        const myRole = (me?.role || "").toLowerCase();

        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role, location")
          .eq("onboarding_completed", true)
          .not("avatar_url", "is", null)
          .not("full_name", "is", null)
          .neq("user_id", user.id)
          .limit(40);

        const ranked = (data || [])
          .map((p: any) => {
            let score = 0;
            const cLoc = (p.location || "").toLowerCase();
            const cRole = (p.role || "").toLowerCase();
            if (cityKey && cLoc.includes(cityKey)) score += 5;
            if (myRole && cRole && cRole !== myRole) score += 2; // complementary
            if (myRole && cRole === myRole) score += 1;
            return { ...p, _s: score + Math.random() };
          })
          .sort((a: any, b: any) => b._s - a._s)
          .slice(0, 3);

        setMatches(ranked);
      } catch (e) {
        console.error("[FirstWinSheet]", e);
      } finally {
        setLoading(false);
      }
    })().catch(() => setLoading(false));

    return () => clearTimeout(t);
  }, [open, user]);

  const handleConnect = async (m: Match) => {
    if (!user || connected.has(m.user_id)) return;
    setConnecting(m.user_id);
    try {
      await supabase.rpc("create_bidirectional_connection", {
        user1_uuid: user.id,
        user2_uuid: m.user_id,
        connection_status: "pending",
      });
      setConnected((s) => new Set(s).add(m.user_id));
    } catch (e) {
      console.error("[FirstWinSheet] connect", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleClose = () => {
    if (user) localStorage.setItem(`first_win_seen_${user.id}`, "1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="sm:max-w-md p-0 border-none overflow-hidden max-h-[92dvh] overflow-y-auto bg-card">
        <div className="absolute top-0 left-1/2 z-50">
          <Confetti active={confetti} config={confettiConfig} />
        </div>

        <div className="relative bg-gradient-to-br from-primary via-primary/85 to-energy/40 pt-8 pb-6 px-6 text-center">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-energy text-energy-foreground text-[10px] font-bold tracking-widest mb-3">
            <Sparkles className="h-3 w-3" />
            YOU'RE IN
          </div>
          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">
            Meet 3 creators near you
          </h2>
          <p className="text-white/80 text-xs">
            Tap Connect — they'll know you're here too.
          </p>
        </div>

        <div className="p-5 space-y-3">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && matches.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No matches near you yet — explore the map to find your scene.
            </p>
          )}

          {!loading &&
            matches.map((m) => {
              const isConnected = connected.has(m.user_id);
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
                >
                  <button
                    onClick={() => navigate(`/profile/${m.user_id}`)}
                    className="shrink-0"
                  >
                    <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                      <AvatarImage src={m.avatar_url || ""} className="object-cover" />
                      <AvatarFallback>{(m.full_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                  </button>
                  <button
                    onClick={() => navigate(`/profile/${m.user_id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-bold text-foreground truncate">
                      {m.full_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.role || "Creative"}
                      {m.location && (
                        <span className="inline-flex items-center gap-0.5 ml-1">
                          · <MapPin className="h-2.5 w-2.5" /> {m.location.split(",")[0]}
                        </span>
                      )}
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant={isConnected ? "secondary" : "default"}
                    disabled={connecting === m.user_id || isConnected}
                    onClick={() => handleConnect(m)}
                    className="shrink-0 h-8 px-3 text-xs font-bold"
                  >
                    {isConnected ? "Sent ✓" : connecting === m.user_id ? "..." : "Connect"}
                  </Button>
                </div>
              );
            })}

          <Button
            onClick={handleClose}
            variant="ghost"
            className="w-full gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
          >
            Continue to home <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
