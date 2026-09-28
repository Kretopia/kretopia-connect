import { AlarmClock, ArrowRight, Check, Clock, MessageCircle, Sparkles, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { HoloCard } from "@/components/passport/HoloCard";
import { CtaButton } from "@/components/ui/cta-button";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/hooks/use-toast";

import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import type { ProfileRow, TodaySignals } from "./today.types";
import {
  acceptProposal,
  completeTask,
  dismissProposal,
  fillKretoPrompt,
  openKretoChat,
  snoozeTaskToTomorrow,
} from "./today.actions";

const TODAY_TUTORIAL: TutorialStep[] = [
  {
    icon: Sparkles,
    title: "Tell Kreto what's next",
    body: "Type or speak what you're working on. Kreto helps you decide what to do next.",
  },
  {
    icon: ArrowRight,
    title: "Your Passport and next move",
    body: "Your Passport, today's next move and your activity each have a clear place.",
  },
  {
    icon: Check,
    title: "Keep moving",
    body: "Complete, review or snooze the one thing that matters most right now.",
  },
];

interface TodayCommandCenterProps {
  firstName?: string;
  profile?: ProfileRow | null;
  creditCount?: number;
  signals: TodaySignals;
  onSignalsChanged: () => void;
}

interface PassportKretoCardProps {
  profile: ProfileRow;
  creditCount: number;
  completion: number;
  firstName?: string;
  onKreto: () => void;
}

interface TodayPriorityCardProps {
  signals: TodaySignals;
  reducedMotion: boolean;
  onSignalsChanged: () => void;
}

/**
 * TodayCommandCenter
 *
  * Three equally sized surfaces: Passport with Kreto, one next action, and
  * supporting activity drawn from the same live signals.
 */
export function TodayCommandCenter({
  firstName,
  profile,
  creditCount = 0,
  signals,
  onSignalsChanged,
}: TodayCommandCenterProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="space-y-5">
      <FeaturePageHeader
        eyebrow="Today"
        title={firstName ? `${firstName},` : "Today,"}
        accentTitle="here's what moves you forward today."
        subtitle={priorityLine(signals)}
        tutorial={{
          featureKey: "today",
          label: "How Today works",
          steps: TODAY_TUTORIAL,
        }}
        compact
      />

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-3">
        {profile && signals.passport ? (
          <PassportKretoCard
            profile={profile}
            creditCount={creditCount}
            completion={signals.passport.percentage}
            firstName={firstName}
            onKreto={openKretoChat}
          />
        ) : (
          <HoloCard maxTilt={3} className="h-full min-w-0">
            <section aria-label="Creative Passport and Kreto" className="flex h-full min-h-[320px] min-w-0 flex-col rounded-2xl border border-energy/30 bg-card p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-energy">My Creative Passport</p>
              <p className="mt-4 text-sm text-muted-foreground">Your Passport will appear here once your profile is ready.</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-4">
                <Link to="/passport" className="inline-flex items-center gap-1 text-xs font-semibold text-energy hover:underline">Open Passport <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
                <Button type="button" variant="outline" size="sm" onClick={openKretoChat} className="gap-2"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> Ask Kreto</Button>
              </div>
            </section>
          </HoloCard>
        )}
        <TodayPriorityCard signals={signals} reducedMotion={reducedMotion} onSignalsChanged={onSignalsChanged} />
        <TodayActivityCard signals={signals} />
      </div>
    </div>
  );
}

/**
 * Passport + Kreto
 *
 * The shared card keeps Passport and Kreto together with distinct actions.
 */
function PassportKretoCard({
  profile,
  creditCount,
  completion,
  firstName,
  onKreto,
}: PassportKretoCardProps) {
  const displayName = profile.full_name || profile.username || firstName || "Your Passport";
  const profession = profile.passport_profession || profile.job_title || profile.role || "Creative professional";
  const avatarUrl = profile.avatar_url || "";
  const safeCompletion = Math.max(0, Math.min(100, completion));
  return (
    <HoloCard maxTilt={3} className="h-full min-w-0">
      <section aria-label="Creative Passport and Kreto" className="relative flex h-full min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-energy/30 bg-card p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-energy">My Creative Passport</p>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-energy/30 bg-muted">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-bold text-muted-foreground">{getInitials(displayName)}</span>}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-foreground">{displayName}</h2>
                <p className="truncate text-xs text-muted-foreground">{profession}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Passport · {creditCount} credit{creditCount === 1 ? "" : "s"}</span>
              <span className="font-bold text-energy">{safeCompletion}%</span>
            </div>
            <div role="progressbar" aria-label="Passport completion" aria-valuenow={safeCompletion} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-energy transition-[width] duration-500" style={{ width: `${safeCompletion}%` }} />
            </div>
          </div>
          <div className="mt-4 flex min-w-0 items-center gap-2 border-t border-border pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-energy">Kreto · Creator intelligence</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your Executive Producer is here for your next move.</p>
            </div>
            <div className="pointer-events-none shrink-0" aria-hidden><KretoCharacter variant="main" size={56} floatAmplitude={1} floatDuration={8} /></div>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
            <Link to="/passport" className="inline-flex items-center gap-1 text-xs font-semibold text-energy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Passport <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            <Button type="button" variant="outline" size="sm" onClick={onKreto} className="gap-2"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> Ask Kreto</Button>
          </div>
      </section>
    </HoloCard>
  );
}

function TodayActivityCard({ signals }: { signals: TodaySignals }) {
  const upcomingCount = signals.deadlines.filter((task) => !task.overdue).length;
  const completedThisWeek = signals.momentum?.completedThisWeek ?? 0;
  const activeProjects = signals.momentum?.activeProjects.length ?? 0;
  const nextMilestone = signals.momentum?.nextMilestone;
  const hasActivity = upcomingCount > 0 || completedThisWeek > 0 || activeProjects > 0 || signals.approvalCount > 0 || signals.unreadMessages > 0 || !!nextMilestone || !!signals.stamps?.waitingForCoSign;

  return (
    <HoloCard maxTilt={3} className="h-full min-w-0">
      <section aria-label="Your activity" className="flex h-full min-h-[320px] min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-energy">Your activity</p>
        <h2 className="mt-1 text-base font-bold text-foreground">Moving forward</h2>
        {hasActivity ? (
          <div className="mt-4 space-y-2 text-sm text-foreground">
            {activeProjects > 0 && <p><span className="font-bold text-energy">{activeProjects}</span> active project{activeProjects === 1 ? "" : "s"}</p>}
            {upcomingCount > 0 && <p><span className="font-bold text-energy">{upcomingCount}</span> due in the next 7 days</p>}
            {completedThisWeek > 0 && <p><span className="font-bold text-energy">{completedThisWeek}</span> completed this week</p>}
            {signals.approvalCount > 0 && <p><span className="font-bold text-energy">{signals.approvalCount}</span> Kreto suggestion{signals.approvalCount === 1 ? "" : "s"} to review</p>}
            {signals.unreadMessages > 0 && <Link to="/messages" className="inline-flex items-center gap-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-bold text-energy">{signals.unreadMessages}</span> unread message{signals.unreadMessages === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" aria-hidden /></Link>}
            {(signals.stamps?.waitingForCoSign ?? 0) > 0 && <p><span className="font-bold text-energy">{signals.stamps?.waitingForCoSign}</span> credit{signals.stamps?.waitingForCoSign === 1 ? "" : "s"} awaiting co-sign</p>}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">No recent activity yet.</p>}
        {nextMilestone && <p className="mt-3 text-xs text-muted-foreground">Next milestone: <span className="font-medium text-foreground">{nextMilestone.title}</span> · {nextMilestone.projectTitle} · {new Date(`${nextMilestone.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
        <Link to="/desk" className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-xs font-semibold text-energy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Studio <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
      </section>
    </HoloCard>
  );
}

/**
 * Today priority
 *
 * Displays one consequential next move, not a dashboard of competing options.
 */
function TodayPriorityCard({ signals, reducedMotion, onSignalsChanged }: TodayPriorityCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { priority, primaryCta } = signals;

  const runPrimaryCta = () => {
    if ("href" in primaryCta) {
      navigate(primaryCta.href);
      return;
    }

    if (primaryCta.event === "thrive-copilot:open") {
      openKretoChat();
      return;
    }

    fillKretoPrompt(String(primaryCta.detail?.prompt ?? ""));
  };

  const handleComplete = async () => {
    if (priority.kind !== "task") return;

    try {
      await completeTask(priority.task.id);
      toast({
        title: "Marked complete",
        description: priority.task.title,
      });
      onSignalsChanged();
    } catch {
      toast({
        title: "Couldn't complete that task",
        variant: "destructive",
      });
    }
  };

  const handleSnooze = async () => {
    if (priority.kind !== "task") return;

    try {
      await snoozeTaskToTomorrow(priority.task.id);
      toast({ title: "Snoozed to tomorrow" });
      onSignalsChanged();
    } catch {
      toast({
        title: "Couldn't snooze that task",
        variant: "destructive",
      });
    }
  };

  const handleAccept = async () => {
    if (priority.kind !== "approval") return;

    try {
      await acceptProposal(priority.approval.id);

      if (priority.approval.href) {
        navigate(priority.approval.href);
      } else {
        onSignalsChanged();
      }
    } catch {
      toast({
        title: "Couldn't open that suggestion",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async () => {
    if (priority.kind !== "approval") return;

    try {
      await dismissProposal(priority.approval.id);
      onSignalsChanged();
    } catch {
      toast({
        title: "Couldn't dismiss that",
        variant: "destructive",
      });
    }
  };

  return (
    <HoloCard maxTilt={3} className="h-full min-w-0">
    <section aria-label="Today's next action" className="flex h-full min-h-[320px] min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Today</p>
          <h2 className="mt-1 text-base font-bold text-foreground">Your next move</h2>
        </div>

        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {priority.kind === "task" ? (
          <motion.div
            key={`task-${priority.task.id}`}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            className="mt-5"
          >
            <PriorityLabel overdue={priority.task.overdue} />

            <h3 className="mt-2 text-lg font-bold leading-snug text-foreground">{priority.task.title}</h3>

            <p className="mt-1 text-sm text-muted-foreground">{priority.task.projectTitle}</p>

            <PriorityActions>
              <Button type="button" size="sm" onClick={handleComplete} className="gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Complete
              </Button>

              <Button type="button" size="sm" variant="outline" onClick={handleSnooze}>
                Snooze
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/desk/${priority.task.projectId}`)}
                className="gap-1"
              >
                Open Project
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </PriorityActions>
          </motion.div>
        ) : priority.kind === "approval" ? (
          <motion.div
            key={`approval-${priority.approval.id}`}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            className="mt-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Kreto suggests</p>

            <h3 className="mt-2 text-lg font-bold leading-snug text-foreground">{priority.approval.title}</h3>

            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{priority.approval.body}</p>

            <PriorityActions>
              <Button type="button" size="sm" onClick={handleAccept} className="gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Review
              </Button>

              <Button type="button" size="sm" variant="ghost" onClick={handleDismiss} className="gap-1.5">
                <X className="h-3.5 w-3.5" aria-hidden />
                Not now
              </Button>
            </PriorityActions>
          </motion.div>
        ) : priority.kind === "gig" ? (
          <motion.div
            key={`gig-${priority.gig.id}`}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            className="mt-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Fresh Call</p>

            <h3 className="mt-2 text-lg font-bold leading-snug text-foreground">{priority.gig.title}</h3>

            {priority.gig.company ? <p className="mt-1 text-sm text-muted-foreground">{priority.gig.company}</p> : null}

            <PriorityActions>
              <CtaButton type="button" onClick={() => navigate("/scout")} className="gap-1.5">
                View Call
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
            </PriorityActions>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-5 flex items-start gap-3"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">
              You're all caught up. A good moment to start something.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {priority.kind !== "task" && priority.kind !== "approval" && priority.kind !== "gig" ? (
        <CtaButton type="button" onClick={runPrimaryCta} className="mt-auto w-full gap-1.5 pt-4 sm:w-fit">
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </CtaButton>
      ) : null}
    </section>
    </HoloCard>
  );
}

function PriorityLabel({ overdue }: { overdue?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
        overdue ? "text-destructive" : "text-primary"
      }`}
    >
      {overdue ? <AlarmClock className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
      {overdue ? "Overdue" : "Due today"}
    </span>
  );
}

function PriorityActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>;
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function priorityLine(signals: TodaySignals): string {
  return signals.priority.kind === "none" ? "Your work at a glance." : "One next move, grounded in your work.";
}

export default TodayCommandCenter;
