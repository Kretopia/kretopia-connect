/**
 * KretopiaFeatureTutorial — Landing Final Conversion Overhaul §6.
 *
 * Replaces the always-visible, auto-playing tutorial (FeatureTutorialPanel)
 * with a discreet, opt-in one: the chapter's visual stays exactly as it
 * was, and a small fingerprint button opens the tutorial in an accessible
 * dialog instead of it playing inline whether the visitor wants it to or
 * not. Rolled out to the core-loop chapters only (Passport, Verified
 * Credits, Scout, Studio) per explicit product direction — Match, Kreto
 * and Community keep their existing FeatureTutorialPanel unchanged.
 *
 * Reuses FeatureTutorial.tsx as-is for the actual step-by-step content —
 * that component already has everything this brief asks for (full
 * role="tablist"/"tab"/aria-selected semantics, all four
 * ArrowLeft/ArrowRight/Home/End keys, a fixed-height panel with no
 * auto-scroll, touch swipe, and a complete prefers-reduced-motion
 * fallback) and is already proven in production (Messages.tsx). Building
 * a second, incompatible tutorial engine here would be exactly what the
 * brief's own instruction warns against.
 *
 * The Dialog wrapper (Radix via src/components/ui/dialog.tsx) provides
 * the focus trap, Escape-to-close, focus return, and close button this
 * needs for free — the same accessible primitive already used throughout
 * the rest of the app, not a bespoke overlay.
 */
import { Fingerprint } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { FeatureTutorial, type TutorialStep } from "./FeatureTutorial";

interface KretopiaFeatureTutorialProps {
  steps: TutorialStep[];
  /** e.g. "Passport" — used to build the accessible name and dialog title. */
  featureName: string;
}

export function KretopiaFeatureTutorial({ steps, featureName }: KretopiaFeatureTutorialProps) {
  const reducedMotion = useReducedMotion();

  return (
    // Dialog wraps Tooltip (not the other way around) so the trigger button
    // is a real Radix DialogTrigger, not a plain onClick outside the Dialog
    // tree -- that's what makes Radix's own focus-trap AND automatic
    // focus-return-on-close work. A plain button that just calls
    // setOpen(true) opens the dialog fine but silently drops focus to
    // <body> on close instead of back to this button (confirmed by testing
    // this exact mistake first, before landing on this composition).
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Open how ${featureName} works`}
              className={`group inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] py-2 pl-2 pr-4 transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${reducedMotion ? "" : "ai-ambient-breathe"}`}
              style={{ ["--tw-ring-color" as string]: "#FF2DA1" }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                <Fingerprint className="h-4 w-4 text-white/60 transition-colors group-hover:text-white" aria-hidden />
              </span>
              <span
                className="text-xs font-semibold text-white/85 transition-colors group-hover:text-white"
                style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                See how it works
              </span>
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Open how {featureName} works</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-lg border-white/10 bg-[#0b0e16] p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-white" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            How {featureName} works
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-4">
          <FeatureTutorial steps={steps} label={`${featureName} tutorial`} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KretopiaFeatureTutorial;
