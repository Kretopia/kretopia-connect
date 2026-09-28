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
    body: "Your Creative Passport and the most useful action for today live together in one place.",
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
  signals: TodaySignals;
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
 * The Today page intentionally exposes only two clear areas:
 *
 * 1. Passport + Kreto:
 *    The Passport is the only place from which the user can edit their profile.
 *    Passport and Kreto have their own accessible actions within one card.
 *
 * 2. Today's priority:
 *    One contextual action based on real signals.
 *
 * This prevents duplicated Passport actions, excessive CTAs and mobile overload.
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

      <div className="space-y-4">
        {profile && signals.passport ? (
          <PassportKretoCard
            profile={profile}
            creditCount={creditCount}
            completion={signals.passport.percentage}
            firstName={firstName}
            signals={signals}
            onKreto={openKretoChat}
          />
        ) : null}

        {(signals.priority.kind !== "none" || signals.primaryCta.label !== "Ask Kreto") && (
          <TodayPriorityCard signals={signals} reducedMotion={reducedMotion} onSignalsChanged={onSignalsChanged} />
        )}
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
  signals,
  onKreto,
}: PassportKretoCardProps) {
  const displayName = profile.full_name || profile.username || firstName || "Your Passport";
  const profession = profile.passport_profession || profile.job_title || profile.role || "Creative professional";
  const avatarUrl = profile.avatar_url || "";
  const safeCompletion = Math.max(0, Math.min(100, completion));
  const upcomingCount = signals.deadlines.filter((task) => !task.overdue).length;
  const completedThisWeek = signals.momentum?.completedThisWeek;
  const nextMilestone = signals.momentum?.nextMilestone;

  return (
    <HoloCard maxTilt={3}>
      <section aria-label="Creative Passport and Kreto" className="relative overflow-hidden rounded-2xl border border-energy/30 bg-card p-5 sm:p-6">
        <div className="relative z-10 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-7">
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
            <Link to="/passport" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-energy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Open Passport <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-3 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-energy">Kreto · Creator intelligence</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{creatorIntelligenceCopy(signals)}</p>
              <Button type="button" variant="outline" size="sm" onClick={onKreto} className="mt-3 gap-2">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Ask Kreto
              </Button>
            </div>
            <div className="pointer-events-none shrink-0" aria-hidden><KretoCharacter variant="main" size={80} floatAmplitude={1} floatDuration={8} /></div>
          </div>
        </div>
        {(upcomingCount > 0 || signals.approvalCount > 0 || signals.unreadMessages > 0 || (completedThisWeek ?? 0) > 0 || nextMilestone) && (
          <div className="relative z-10 mt-5 border-t border-border pt-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your activity</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
              {upcomingCount > 0 && <Link to="/desk" className="inline-flex items-center gap-1.5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-bold text-energy">{upcomingCount}</span> due this week <ArrowRight className="h-3 w-3" aria-hidden /></Link>}
              {signals.approvalCount > 0 && <span className="text-foreground"><span className="font-bold text-energy">{signals.approvalCount}</span> Kreto suggestion{signals.approvalCount === 1 ? "" : "s"} to review</span>}
              {signals.unreadMessages > 0 && <Link to="/messages" className="inline-flex items-center gap-1.5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-bold text-energy">{signals.unreadMessages}</span> unread message{signals.unreadMessages === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" aria-hidden /></Link>}
              {(completedThisWeek ?? 0) > 0 && <span className="text-foreground"><span className="font-bold text-energy">{completedThisWeek}</span> completed this week</span>}
            </div>
            {nextMilestone && (
              <p className="mt-3 text-xs text-muted-foreground">
                Next milestone: <span className="font-medium text-foreground">{nextMilestone.title}</span> · {nextMilestone.projectTitle} · {new Date(`${nextMilestone.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            )}
          </div>
        )}
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
    <section aria-label="Today's next action" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
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
        <CtaButton type="button" onClick={runPrimaryCta} className="mt-5 w-full gap-1.5 sm:w-fit">
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </CtaButton>
      ) : null}
    </section>
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

function creatorIntelligenceCopy(signals: TodaySignals) {
  if (signals.unreadMessages > 0) return `${signals.unreadMessages} unread message${signals.unreadMessages === 1 ? "" : "s"} waiting for you.`;
  if (signals.stamps?.waitingForCoSign) return `${signals.stamps.waitingForCoSign} credit${signals.stamps.waitingForCoSign === 1 ? "" : "s"} waiting for a co-sign.`;
  if (signals.priority.kind !== "none") return "Your next move is below.";
  return "No pressing updates right now.";
}

function priorityLine(signals: TodaySignals): string {
  return signals.priority.kind === "none" ? "Your work at a glance." : "One next move, grounded in your work.";
}

export default TodayCommandCenter;
