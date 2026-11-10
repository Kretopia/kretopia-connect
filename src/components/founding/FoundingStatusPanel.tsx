import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Confetti from "react-dom-confetti";
import { CheckCircle2, Trophy, Calendar, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useFoundingMemberProgress } from "@/hooks/useFoundingMemberProgress";
import { FOUNDING_QUESTS, FOUNDING_MEMBER_CAP, foundingDeadlineLabel, foundingDaysLeft } from "@/lib/foundingMember";
import { cn } from "@/lib/utils";

const QUEST_CTA: Record<string, { label: string; to: string }> = {
  claim_profile: { label: "Verify profile", to: "/profile" },
  log_credits: { label: "Add a credit", to: "/profile" },
  invite_signups: { label: "Invite friends", to: "/profile?tab=invite" },
};

// Same recipe as NewRoomLaunchScreen's own celebration: three confetti
// emitters across the top, one hsl(var(--energy))-based config -- one visual
// language for "you just earned something" across the app.
const confettiConfig = {
  angle: 90,
  spread: 280,
  startVelocity: 55,
  elementCount: 140,
  dragFriction: 0.1,
  duration: 5000,
  stagger: 2,
  width: "10px",
  height: "10px",
  colors: ["hsl(var(--energy))", "#ffffff", "hsl(var(--energy) / 0.6)", "hsl(var(--accent))"],
};

/**
 * The member's Founding status: the badge, how far along the three milestones are, and what is left to do.
 *
 * Founding Circle used to be a page and a menu entry of its own (/founding-member). It is a status of a Creative Circle member now, so this is
 * the page's body, same data (useFoundingMemberProgress), same milestones and same actions, drawn inside Creative Circle. /founding-member
 * redirects to this section (id="founding").
 */
export function FoundingStatusPanel({ className }: { className?: string }) {
  const { loading, progress, completedCount, allComplete, badgeAwarded } = useFoundingMemberProgress();
  const [showConfetti, setShowConfetti] = useState(false);

  const total = FOUNDING_QUESTS.length;
  const pct = Math.round((completedCount / total) * 100);
  const deadline = foundingDeadlineLabel();
  const daysLeft = foundingDaysLeft();
  const urgent = daysLeft <= 14;
  const earned = allComplete || badgeAwarded;

  // Fires once, the moment all milestones are already complete on arrival
  // or become complete live -- never replays on every render.
  useEffect(() => {
    if (!allComplete) { setShowConfetti(false); return; }
    const t = setTimeout(() => setShowConfetti(true), 250);
    return () => clearTimeout(t);
  }, [allComplete]);

  return (
    <section id="founding" aria-labelledby="founding-status-heading" className={cn("scroll-mt-24 space-y-3", className)}>
      <div>
        <h2 id="founding-status-heading" className="font-bold text-lg tracking-tight">Founding status</h2>
        <p className="text-sm text-muted-foreground">
          Complete {total} milestones before the deadline to earn a permanent Founding Member badge on your Passport. Only {FOUNDING_MEMBER_CAP} exist.
        </p>
      </div>

      <Card className={cn("relative overflow-hidden rounded-2xl border-border/60 p-5 shadow-none", earned && "shadow-glow")}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(65% 60% at 50% 0%, hsl(var(--energy) / 0.14), transparent 65%)" }}
        />
        <div className="absolute top-0 left-1/4 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-1/2 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-3/4 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>

        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div
            className={cn(
              "h-16 w-16 shrink-0 rounded-full flex items-center justify-center border-2 bg-gradient-to-br transition-all",
              badgeAwarded
                ? "from-[hsl(var(--energy)/0.3)] via-accent/20 to-[hsl(var(--energy)/0.05)] border-[hsl(var(--energy))] shadow-glow"
                : allComplete
                  ? "from-[hsl(var(--energy)/0.22)] to-[hsl(var(--energy)/0.05)] border-[hsl(var(--energy)/0.7)]"
                  : "from-muted/40 to-muted/10 border-border",
            )}
          >
            <Trophy className={cn("h-8 w-8", earned ? "text-[hsl(var(--energy))]" : "text-muted-foreground")} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "hsl(var(--energy))" }}>
              <Sparkles className="h-3 w-3" aria-hidden />
              {FOUNDING_MEMBER_CAP} badges. Ever.
            </p>
            <p className="mt-1 text-lg font-black tracking-[-0.02em]">
              {badgeAwarded ? "Your badge is live." : allComplete ? "You earned it." : `${completedCount} of ${total} milestones complete`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {badgeAwarded
                ? "Permanently on your public Passport, as one of Kretopia's first 100 members."
                : allComplete
                  ? `All ${total} milestones complete — your badge will appear on your profile shortly.`
                  : `Finish all ${total} to claim a permanent Founding Member badge on your Passport.`}
            </p>

            <div className="mx-auto mt-4 max-w-xs space-y-1.5 sm:mx-0">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">{completedCount} of {total} completed</span>
                <span className="text-foreground">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                  urgent && !badgeAwarded ? "text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)]" : "text-muted-foreground border-border bg-card",
                )}
              >
                <Calendar className="h-3 w-3" />
                Closes {deadline} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
              </div>
              {earned && (
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/profile">View my profile</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Milestones: a static grid, not a carousel -- three fixed steps that all fit. */}
      <div role="list" aria-label="Founding milestones" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {FOUNDING_QUESTS.map((quest, i) => {
          const p = progress[quest.key];
          const cta = QUEST_CTA[quest.key];
          const questPct = Math.round((p.current / p.target) * 100);
          return (
            <Card
              key={quest.key}
              role="listitem"
              className={cn(
                "h-full rounded-2xl border-border/60 p-4 shadow-none transition-colors",
                p.completed && "border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.04)]",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border-2",
                    p.completed
                      ? "bg-[hsl(var(--energy))] border-[hsl(var(--energy))] text-[hsl(var(--energy-foreground))] shadow-glow"
                      : "bg-muted border-border text-muted-foreground",
                  )}
                >
                  {p.completed ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{quest.title}</p>
                    <span className={cn("shrink-0 font-mono text-xs", p.completed ? "text-[hsl(var(--energy))]" : "text-muted-foreground")}>
                      {p.current}/{p.target}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{quest.description}</p>
                  <div className="mt-2.5">
                    <Progress value={questPct} className="h-1.5" />
                  </div>
                  {!p.completed && cta && (
                    <Button asChild variant="outline" size="sm" className="mt-3 h-8 text-xs">
                      <Link to={cta.to}>{cta.label}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KretopiaSpinner className="h-3.5 w-3.5" /> Checking your progress…
        </p>
      )}
    </section>
  );
}
