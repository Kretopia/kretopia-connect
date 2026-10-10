import { KretoMark } from "@/components/brand/KretoMark";
import { KretoScene } from "@/components/brand/KretoScene";
import { OutlineCtaButton } from "@/components/ui/glass-cta";
import { cn } from "@/lib/utils";

/** The prompt Kreto gets: the same one Scout's Kreto tip used for "draft a pitch". */
export const SCOUT_PITCH_PROMPT = "Help me draft a pitch for the opportunity I'm looking at — in my voice.";

interface ScoutKretoAssistProps {
  /** Read when the button is pressed; appended to the prompt so Kreto sees the gigs on screen. */
  getPromptContext?: () => string | undefined;
  className?: string;
}

/**
 * Kreto's place on Scout: after the results, once there is something to act
 * on, and quieter than the tabs and the top gigs above it. It promises one
 * thing, a draft for the person's review, and does nothing by itself: the
 * button only opens Kreto with the prompt.
 */
export function ScoutKretoAssist({ getPromptContext, className }: ScoutKretoAssistProps) {
  const ask = () => {
    const context = getPromptContext?.();
    const prompt = context ? `${SCOUT_PITCH_PROMPT}\n\n${context}` : SCOUT_PITCH_PROMPT;
    window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt } }));
  };

  return (
    <aside
      aria-label="Kreto can help"
      className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-nowrap sm:gap-4", className)}
    >
      <KretoMark size="md" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-semibold text-foreground">Found one worth pursuing?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Kreto can prepare a draft pitch for your review.</p>
      </div>
      <KretoScene scene="assistant" size="thumb" className="hidden h-14 w-28 shrink-0 rounded-xl border border-border md:block" />
      <OutlineCtaButton onClick={ask} className="min-h-11 w-full shrink-0 sm:w-auto">
        Ask Kreto
      </OutlineCtaButton>
    </aside>
  );
}

export default ScoutKretoAssist;
