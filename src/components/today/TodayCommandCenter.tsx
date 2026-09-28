import { AlarmClock, ArrowRight, Check, Clock, MapPin, MessageCircle, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
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
  reducedMotion: boolean;
  onOpenPassport: () => void;
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
 *    The entire card is clickable and opens /passport.
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
            reducedMotion={reducedMotion}
            onOpenPassport={() => {
              window.location.assign("/passport");
            }}
            onKreto={openKretoChat}
          />
        ) : null}

        <TodayPriorityCard signals={signals} reducedMotion={reducedMotion} onSignalsChanged={onSignalsChanged} />
      </div>
    </div>
  );
}

/**
 * Passport + Kreto
 *
 * The whole card is the single Passport interaction.
 * There is deliberately no separate edit button.
 */
function PassportKretoCard({
  profile,
  creditCount,
  completion,
  firstName,
  reducedMotion,
  onOpenPassport,
  onKreto,
}: PassportKretoCardProps) {
  const displayName = profile.full_name || profile.username || firstName || "Your Passport";

  const profession = profile.passport_profession || profile.job_title || profile.role || "Creative professional";

  const location = profile.location || "";

  const avatarUrl = profile.avatar_url || "";

  const safeCompletion = Math.max(0, Math.min(100, completion));

  return (
    <section
      aria-label="Creative Passport and Kreto"
      className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]"
    >
      <button
        type="button"
        onClick={onOpenPassport}
        aria-label="Open and edit your Creative Passport"
        className="group relative min-h-[220px] overflow-hidden rounded-3xl border border-border bg-card text-left transition-all duration-300 hover:border-primary/50 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 80% 25%, hsl(var(--primary) / 0.18), transparent 38%), radial-gradient(circle at 15% 100%, hsl(var(--energy) / 0.08), transparent 42%)",
          }}
        />

        <div className="relative flex h-full min-h-[220px] flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  My Creative Passport
                </p>
                <h2 className="mt-1 truncate text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  {displayName}
                </h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{profession}</p>
              </div>
            </div>

            <ArrowRight
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground"
              aria-hidden
            />
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{location}</span>
                </span>
              ) : null}

              <span>
                {creditCount} {creditCount === 1 ? "credit" : "credits"}
              </span>

              <span>Open to collaboration</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Passport progress</span>
                <span className="font-bold text-foreground">{safeCompletion}% complete</span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={reducedMotion ? false : { width: 0 }}
                  animate={{ width: `${safeCompletion}%` }}
                  transition={{ duration: 0.65, ease: "easeOut" }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground transition-colors group-hover:text-foreground/80">
              Tap or click your Passport to view or edit it.
            </p>
          </div>
        </div>
      </button>

      <div className="relative min-h-[220px] overflow-hidden rounded-3xl border border-primary/25 bg-primary/[0.035] p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: "radial-gradient(circle at 90% 10%, hsl(var(--primary) / 0.12), transparent 40%)",
          }}
        />

        <div className="pointer-events-none absolute bottom-0 right-0 hidden opacity-75 sm:block" aria-hidden>
          <KretoCharacter variant="main" size={132} floatAmplitude={2} floatDuration={8} />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between sm:pr-24">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Kreto · Creator intelligence
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Based on your Passport, active work and current signals.
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm font-semibold text-foreground">{creatorIntelligenceCopy(completion)}</p>

            <Button type="button" variant="outline" size="sm" onClick={onKreto} className="mt-4 gap-2">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Ask Kreto
            </Button>
          </div>
        </div>
      </div>
    </section>
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

function creatorIntelligenceCopy(completion: number) {
  if (completion < 40) {
    return "Your Passport has room to grow. A few details now will make future opportunities more relevant.";
  }

  if (completion < 80) {
    return "Your Passport is taking shape. Adding one strong credit or collaborator could improve your next match.";
  }

  return "Your Passport is ready to do more work for you. Keep it current as your projects move forward.";
}

function priorityLine(signals: TodaySignals): string {
  const { passport, stamps, priority } = signals;

  if (passport && !passport.isComplete && passport.percentage > 0 && passport.percentage < 80) {
    return `Your Passport is ${passport.percentage}% ready. Complete it when you're ready.`;
  }

  if (stamps && stamps.waitingForCoSign > 0) {
    return `${stamps.waitingForCoSign} credit${stamps.waitingForCoSign === 1 ? "" : "s"} still need${
      stamps.waitingForCoSign === 1 ? "s" : ""
    } a co-sign.`;
  }

  if (priority.kind === "task" && priority.task.overdue) {
    return `"${priority.task.title}" is overdue on ${priority.task.projectTitle}.`;
  }

  return "Your Passport, your work and your next move in one calm view.";
}

export default TodayCommandCenter;
