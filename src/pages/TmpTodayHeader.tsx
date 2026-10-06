// TEMPORARY debug page — reproduces the exact Today header for visual QA.
// Remove this file and its route after verification.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import type { TutorialStep } from "@/components/features/FeatureAITutorial";

const TODAY_TUTORIAL: TutorialStep[] = [
  { icon: Sparkles, title: "Tell Kreto what's next", body: "Type or speak what you're working on. Kreto helps you decide what to do next." },
  { icon: ArrowRight, title: "Your Passport and next move", body: "Your Passport, today's next move and your activity each have a clear place." },
  { icon: Check, title: "Keep moving", body: "Complete, review or snooze the one thing that matters most right now." },
];

export default function TmpTodayHeader() {
  // Mirror the real mount: a loading gate first (like signals.loading),
  // then TodayDashboard's motion.div wrapper around the header.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        {!ready ? (
          <div className="py-16 text-center text-muted-foreground">loading…</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.65, 0.3, 0.95] }}
          >
            <FeaturePageHeader
              eyebrow="Today"
              title="Noé,"
              accentTitle="here's what moves you forward today."
              subtitle="One thing matters most right now."
              tutorial={{ featureKey: "today", label: "How Today works", steps: TODAY_TUTORIAL }}
              compact
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
