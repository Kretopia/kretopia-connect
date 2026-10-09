import { useState, type ReactNode } from "react";
import { AlarmClock, ArrowRight, Check, Clock, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { GlassCta, GlassCtaButton, OutlineCta, OutlineCtaButton } from "@/components/ui/glass-cta";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/hooks/use-toast";

import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import type { ProfileRow, TodaySignals } from "./today.types";
import { TodayCard } from "./TodayCard";
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
  missingFields: string[];
  firstName?: string;
  onKreto: () => void;
}

interface TodayPriorityCardProps {
  signals: TodaySignals;
  reducedMotion: boolean;
  onSignalsChanged: () => void;
}

/** In-place actions swap the trailing ↗ (which means "goes somewhere") for the
 *  Kretopia spinner while they run, so a second click can't double-fire. */
const busyIcon = (busy: boolean) => (busy ? <KretopiaSpinner className="h-4 w-4" /> : undefined);

/**
 * TodayCommandCenter
 *
 * Three equally sized Holo Cards (Passport with Kreto, one next action, and
 * supporting activity drawn from the same live signals), all built on the one
 * TodayCard shell and all ending in the same Landing CTA pair.
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

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-3 lg:gap-5">
        {profile && signals.passport ? (
          <PassportKretoCard
            profile={profile}
            creditCount={creditCount}
            completion={signals.passport.percentage}
            missingFields={signals.passport.missingFields}
            firstName={firstName}
            onKreto={openKretoChat}
          />
        ) : (
          <TodayCard
            label="Creative Passport and Kreto"
            eyebrow="My Creative Passport"
            title="Make your work visible."
            actions={
              <>
                <GlassCta to="/passport" className="w-full">Build my Passport</GlassCta>
                <OutlineCtaButton onClick={openKretoChat} className="w-full">Ask Kreto</OutlineCtaButton>
              </>
            }
          >
            <p className="text-sm leading-relaxed text-muted-foreground">Your Passport will appear here once your profile is ready.</p>
          </TodayCard>
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
  missingFields,
}: PassportKretoCardProps) {
  const displayName = profile.full_name || profile.username || firstName || "Your Passport";
  const profession = profile.passport_profession || profile.job_title || profile.role || "Creative professional";
  const avatarUrl = profile.avatar_url || "";
  const safeCompletion = Math.max(0, Math.min(100, completion));
  return (
    <TodayCard
      label="Creative Passport and Kreto"
      eyebrow="My Creative Passport"
      title={displayName}
      actions={
        <>
          <GlassCta to="/passport" className="w-full">{missingFields.length > 0 ? "Complete Passport" : "Open Passport"}</GlassCta>
          <OutlineCtaButton onClick={onKreto} className="w-full">Ask Kreto</OutlineCtaButton>
        </>
      }
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-bold text-muted-foreground">{getInitials(displayName)}</span>}
        </div>
        <div className="min-w-0">
          <p className="break-words text-sm text-foreground">{profession}</p>
          <p className="mt-1 text-xs text-muted-foreground">{creditCount} credit{creditCount === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Passport completion</span>
        <span className="font-bold text-foreground">{safeCompletion}%</span>
      </div>
      <div role="progressbar" aria-label="Passport completion" aria-valuenow={safeCompletion} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full k-gradient-fill transition-[width] duration-500" style={{ width: `${safeCompletion}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{missingFields.length > 0 ? `Next to add: ${missingFields.slice(0, 2).join(" · ")}` : "Your Passport is ready to share."}</p>
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Kreto · Creator intelligence</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your Executive Producer is here for your next move.</p>
        </div>
        <div className="pointer-events-none shrink-0" aria-hidden><KretoCharacter variant="main" size={56} floatAmplitude={1} floatDuration={8} /></div>
      </div>
    </TodayCard>
  );
}

function TodayActivityCard({ signals }: { signals: TodaySignals }) {
  const upcomingCount = signals.deadlines.filter((task) => !task.overdue).length;
  const completedThisWeek = signals.momentum?.completedThisWeek ?? 0;
  const activeProjects = signals.momentum?.activeProjects.length ?? 0;
  const nextMilestone = signals.momentum?.nextMilestone;
  const hasActivity = upcomingCount > 0 || completedThisWeek > 0 || activeProjects > 0 || signals.approvalCount > 0 || signals.unreadMessages > 0 || !!nextMilestone || !!signals.stamps?.waitingForCoSign;

  return (
    <TodayCard
      label="Your activity"
      eyebrow="Your activity"
      title="Moving forward"
      actions={
        <>
          <GlassCta to={signals.unreadMessages > 0 ? "/messages" : "/desk"} className="w-full">{signals.unreadMessages > 0 ? "Read messages" : "Open Studio"}</GlassCta>
          <OutlineCtaButton onClick={openKretoChat} className="w-full">Ask Kreto</OutlineCtaButton>
        </>
      }
    >
      {hasActivity ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm text-foreground">
          <div><strong className="block text-2xl text-foreground">{activeProjects}</strong><span>active project{activeProjects === 1 ? "" : "s"}</span></div>
          <div><strong className="block text-2xl text-foreground">{upcomingCount}</strong><span>due in the next 7 days</span></div>
          <div><strong className="block text-2xl text-foreground">{completedThisWeek}</strong><span>completed this week</span></div>
          <div><strong className="block text-2xl text-foreground">{signals.unreadMessages}</strong><span>unread message{signals.unreadMessages === 1 ? "" : "s"}</span></div>
        </div>
      ) : <p className="text-sm text-muted-foreground">No recent activity yet.</p>}
      <div className="mt-5 space-y-3 text-xs leading-relaxed text-muted-foreground">
        {signals.approvalCount > 0 && <p><span className="font-bold text-foreground">{signals.approvalCount}</span> Kreto suggestion{signals.approvalCount === 1 ? "" : "s"} to review</p>}
        {(signals.stamps?.waitingForCoSign ?? 0) > 0 && <p><span className="font-bold text-foreground">{signals.stamps?.waitingForCoSign}</span> credit{signals.stamps?.waitingForCoSign === 1 ? "" : "s"} awaiting co-sign</p>}
        {nextMilestone && <p>Next milestone: <span className="font-medium text-foreground">{nextMilestone.title}</span> · {nextMilestone.projectTitle} · {new Date(`${nextMilestone.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
      </div>
    </TodayCard>
  );
}

/**
 * Today priority
 *
 * Displays one consequential next move, not a dashboard of competing options.
 * Whatever the move is, the card ends in the same two Landing CTAs as its
 * siblings: the move itself, then one quiet alternative.
 */
function TodayPriorityCard({ signals, reducedMotion, onSignalsChanged }: TodayPriorityCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { priority, primaryCta } = signals;
  const [busy, setBusy] = useState<"complete" | "snooze" | "review" | "dismiss" | null>(null);

  const guarded = (key: NonNullable<typeof busy>, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

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

  const handleComplete = guarded("complete", async () => {
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
  });

  const handleSnooze = guarded("snooze", async () => {
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
  });

  const handleAccept = guarded("review", async () => {
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
  });

  const handleDismiss = guarded("dismiss", async () => {
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
  });

  const motionProps = {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 5 },
    animate: { opacity: 1, y: 0 },
    exit: reducedMotion ? undefined : { opacity: 0, y: -5 },
    className: "flex flex-1 flex-col",
  };

  let body: ReactNode;
  let actions: ReactNode;

  if (priority.kind === "task") {
    const { task } = priority;
    body = (
      <motion.div key={`task-${task.id}`} {...motionProps}>
        <PriorityLabel overdue={task.overdue} />
        <h3 className="mt-3 break-words text-lg font-bold leading-snug text-foreground">{task.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link to={`/desk/${task.projectId}`} title="Open project" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
            {task.projectTitle}
          </Link>
        </p>
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">Due {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
      </motion.div>
    );
    actions = (
      <>
        <GlassCtaButton onClick={handleComplete} disabled={!!busy} icon={busy === "complete" ? busyIcon(true) : <Check className="h-4 w-4" aria-hidden />} className="w-full">
          Complete
        </GlassCtaButton>
        <OutlineCtaButton onClick={handleSnooze} disabled={!!busy} icon={busyIcon(busy === "snooze")} className="w-full">
          Snooze
        </OutlineCtaButton>
      </>
    );
  } else if (priority.kind === "approval") {
    const { approval } = priority;
    body = (
      <motion.div key={`approval-${approval.id}`} {...motionProps}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Kreto suggests</p>
        <h3 className="mt-3 break-words text-lg font-bold leading-snug text-foreground">{approval.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{approval.body}</p>
      </motion.div>
    );
    actions = (
      <>
        <GlassCtaButton onClick={handleAccept} disabled={!!busy} icon={busyIcon(busy === "review")} className="w-full">
          Review
        </GlassCtaButton>
        <OutlineCtaButton onClick={handleDismiss} disabled={!!busy} icon={busyIcon(busy === "dismiss")} className="w-full">
          Not now
        </OutlineCtaButton>
      </>
    );
  } else if (priority.kind === "gig") {
    const { gig } = priority;
    body = (
      <motion.div key={`gig-${gig.id}`} {...motionProps}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Fresh Call</p>
        <h3 className="mt-3 break-words text-lg font-bold leading-snug text-foreground">{gig.title}</h3>
        {gig.company ? <p className="mt-1 text-sm text-muted-foreground">{gig.company}</p> : null}
      </motion.div>
    );
    actions = (
      <>
        <GlassCtaButton onClick={() => navigate("/scout")} className="w-full">View Call</GlassCtaButton>
        <OutlineCtaButton onClick={openKretoChat} className="w-full">Ask Kreto</OutlineCtaButton>
      </>
    );
  } else {
    const opensKreto = "event" in primaryCta && primaryCta.event === "thrive-copilot:open";
    body = (
      <motion.div key="empty" {...motionProps}>
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            You're all caught up. A good moment to start something.
          </p>
        </div>
      </motion.div>
    );
    actions = (
      <>
        <GlassCtaButton onClick={runPrimaryCta} icon={"event" in primaryCta ? null : undefined} className="w-full">
          {primaryCta.label}
        </GlassCtaButton>
        {opensKreto ? (
          <OutlineCta to="/desk" className="w-full">Open Studio</OutlineCta>
        ) : (
          <OutlineCtaButton onClick={openKretoChat} className="w-full">Ask Kreto</OutlineCtaButton>
        )}
      </>
    );
  }

  return (
    <TodayCard label="Today's next action" eyebrow="Today" title="Your next move" actions={actions}>
      <AnimatePresence mode="wait" initial={false}>
        {body}
      </AnimatePresence>
    </TodayCard>
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
