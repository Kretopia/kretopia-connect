import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BrandLoader } from "@/components/brand/BrandDots";
import { TodayCommandCenter } from "./TodayCommandCenter";
import { TodayRadar } from "./radar/TodayRadar";
import { useTodaySignals } from "./today.selectors";
import type { ProfileRow } from "./today.types";

interface TodayDashboardProps {
  firstName?: string;
  peopleForYou?: ReactNode;
  profile?: ProfileRow | null;
  profileFull?: ProfileRow | null;
  myCredits?: number;
}

/**
 * Today keeps the Passport/Kreto overview and one priority.
 * Deep Passport metrics and tools remain on the Passport itself.
 */
export function TodayDashboard({ firstName, profile, profileFull, myCredits = 0 }: TodayDashboardProps) {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const effectiveProfile = profileFull || profile || null;
  const signals = useTodaySignals(user?.id, effectiveProfile, myCredits);
  const refresh = signals.reload;

  useEffect(() => {
    if (!user?.id) return;
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [user?.id, refresh]);

  if (!user) return null;

  return (
    // Leave room for the fixed bottom composer and navigation.
    <div className="space-y-4 pb-28">
      {signals.loading ? (
        <div className="flex items-center justify-center py-16" aria-busy="true">
          <BrandLoader />
        </div>
      ) : signals.error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.03] px-4 py-4 text-sm text-muted-foreground">
          Couldn't load today's dashboard. <button onClick={refresh} className="font-semibold text-primary underline underline-offset-2">Try again</button>
        </div>
      ) : (
        <motion.div
          className="space-y-10"
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.95] }}
        >
          <TodayCommandCenter firstName={firstName} profile={effectiveProfile} creditCount={myCredits} signals={signals} onSignalsChanged={refresh} />
          {/* After the decision cards, never before: the live radar (next event, events, gigs, people to meet). */}
          <TodayRadar userId={user.id} profile={effectiveProfile} />
        </motion.div>
      )}
    </div>
  );
}

export default TodayDashboard;
