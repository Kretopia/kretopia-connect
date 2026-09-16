import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  FileSignature,
  DollarSign,
  ListChecks,
  Upload,
  ArrowRight,
} from "lucide-react";
import { dispatchDeskIntent, navigateDeskTab } from "@/hooks/useDeskIntent";
import { cn } from "@/lib/utils";

/**
 * Detects intent cues inside a chat message and renders contextual
 * action chips. Pure UI — actions only navigate + prefill (safe pattern).
 */
interface Cue {
  id: string;
  label: string;
  icon: typeof CheckCircle2;
  tab: string;
  intent?: string;
  payload?: Record<string, any>;
}

function detectCues(text: string, hasAttachments: boolean): Cue[] {
  const t = text.toLowerCase();
  const cues: Cue[] = [];

  // Files / drafts
  const filesHinted =
    hasAttachments ||
    /\b(here'?s? (the|my) (file|files|draft|drafts|version|cut|edit|render))\b/.test(t) ||
    /\b(uploaded|sending|attached|sharing) (the|my|some|a few)?\s*(files?|drafts?|assets?)\b/.test(t) ||
    /\bv\d+\b/.test(t);

  // Approval cues
  if (
    filesHinted ||
    /\b(approve|approval|sign[- ]?off|review|feedback|thoughts\?|let me know|good to go|ok to ship)\b/.test(t)
  ) {
    cues.push({
      id: "approval",
      label: "Request approval",
      icon: CheckCircle2,
      tab: "approvals",
      intent: "create-approval",
      payload: hasAttachments ? { title: "Review request" } : undefined,
    });
  }

  // Contract / agreement
  if (
    /\b(contract|agreement|nda|terms|paperwork|scope of work|sow|let'?s (formalize|finalize)|lock (this|it) in)\b/.test(t)
  ) {
    cues.push({
      id: "contract",
      label: "Create agreement",
      icon: FileSignature,
      tab: "contracts",
      intent: "create-contract",
    });
  }

  // Payment / deposit / invoice
  if (
    /\b(deposit|invoice|payment|pay (me|now|up)|wire|transfer|down ?payment|advance|retainer|paid)\b/.test(t) ||
    /\$[\d,]+/.test(text)
  ) {
    cues.push({
      id: "invoice",
      label: "Send invoice",
      icon: DollarSign,
      tab: "finance",
      intent: "create-invoice",
    });
  }

  // Tasks / to-dos
  if (
    /\b(todo|to[- ]?do|task|next steps|action items|let'?s do|we (need|should) (to )?(do|finish|wrap|deliver))\b/.test(t)
  ) {
    cues.push({
      id: "task",
      label: "Create task",
      icon: ListChecks,
      tab: "tasks",
      intent: "create-task",
    });
  }

  // Upload / send work
  if (
    /\b(i'?ll (send|upload|share)|sending (it|over)|uploading|once (it'?s|its) ready)\b/.test(t)
  ) {
    cues.push({
      id: "upload",
      label: "Upload file",
      icon: Upload,
      tab: "files",
      intent: "upload-file",
    });
  }

  // Dedupe by id, cap at 3 to avoid clutter
  const seen = new Set<string>();
  return cues.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).slice(0, 3);
}

interface ChatActionChipsProps {
  message: string;
  hasAttachments?: boolean;
  className?: string;
}

export const ChatActionChips = memo(({ message, hasAttachments, className }: ChatActionChipsProps) => {
  const cues = useMemo(() => detectCues(message || "", !!hasAttachments), [message, hasAttachments]);
  if (!cues.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
      {cues.map((cue) => {
        const Icon = cue.icon;
        return (
          <Button
            key={cue.id}
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 rounded-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground"
            onClick={() => {
              navigateDeskTab(cue.tab);
              if (cue.intent) {
                // small delay so the tab mounts before the intent fires
                setTimeout(() => dispatchDeskIntent(cue.tab, cue.intent!, cue.payload), 80);
              }
            }}
          >
            <Icon className="h-3 w-3 text-primary" />
            {cue.label}
            <ArrowRight className="h-3 w-3 opacity-60" />
          </Button>
        );
      })}
    </div>
  );
});

ChatActionChips.displayName = "ChatActionChips";
