import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, Users, FolderKanban, ArrowRight, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WelcomeProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  circle: any;
  onSwitchTab: (tab: string) => void;
}

/** Shown once after a user joins a circle. Adapts based on what the member already has. */
export function CircleWelcomeModal({ open, onOpenChange, circle, onSwitchTab }: WelcomeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creditCount, setCreditCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("credits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setCreditCount(count ?? 0));
  }, [open, user?.id]);

  const hasCredits = (creditCount ?? 0) > 0;

  const tabActions = [
    {
      icon: Hash, label: "Say hi in chat",
      desc: "Introduce yourself to the circle",
      onClick: () => { onSwitchTab("chat"); onOpenChange(false); },
    },
    {
      icon: Calendar, label: "Join an event",
      desc: "See what's happening this week",
      onClick: () => { onSwitchTab("events"); onOpenChange(false); },
    },
    {
      icon: Users, label: "Meet members",
      desc: "Connect with creatives in this circle",
      onClick: () => { onSwitchTab("members"); onOpenChange(false); },
    },
    {
      icon: FolderKanban, label: "Browse projects",
      desc: "Find collabs to join",
      onClick: () => { onSwitchTab("projects"); onOpenChange(false); },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl mb-3">
            {circle?.icon_emoji || "🎉"}
          </div>
          <DialogTitle className="text-xl font-black">
            Welcome to {circle?.title}!
          </DialogTitle>
          <DialogDescription>
            {hasCredits
              ? "You're in. Here's how to plug into the community."
              : "You're in. Here's how to make it count."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {/* Only nudge to add a credit if they don't have any yet */}
          {!hasCredits && creditCount !== null && (
            <button
              onClick={() => { navigate("/credits/new"); onOpenChange(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-accent/40 bg-accent/5 hover:bg-accent/10 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Add your first credit</p>
                <p className="text-[11px] text-muted-foreground">Show your work — unlocks opportunities</p>
              </div>
              <ArrowRight className="h-4 w-4 text-accent shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {tabActions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <a.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-[11px] text-muted-foreground">{a.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>

        <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
          Explore on my own
        </Button>
      </DialogContent>
    </Dialog>
  );
}
