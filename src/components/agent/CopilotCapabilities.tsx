import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ListChecks,
  DollarSign,
  Users,
  Briefcase,
  Camera,
  Sparkles,
  FileSignature,
  Mail,
  Calendar,
  Award,
  Search,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapabilityChip {
  label: string;
  prompt: string;
  icon: typeof ListChecks;
}

interface CapabilityGroup {
  title: string;
  chips: CapabilityChip[];
}

const GROUPS: CapabilityGroup[] = [
  {
    title: "Projects & Tasks",
    chips: [
      { label: "Plan my week", prompt: "Plan my week across my active projects.", icon: ListChecks },
      { label: "Show overdue", prompt: "What's overdue across my projects?", icon: ListChecks },
      { label: "Draft next task", prompt: "Draft the next task for my main project.", icon: PenLine },
      { label: "Project status", prompt: "Where does my main project stand?", icon: Briefcase },
    ],
  },
  {
    title: "Money & Invoices",
    chips: [
      { label: "Who owes me?", prompt: "Who owes me money right now?", icon: DollarSign },
      { label: "Draft invoice", prompt: "Draft an invoice for my latest completed work.", icon: FileSignature },
      { label: "Payment reminder", prompt: "Draft a friendly payment-due reminder.", icon: Mail },
      { label: "This week's money", prompt: "Summarize this week's money in and out.", icon: DollarSign },
    ],
  },
  {
    title: "Collabs & Outreach",
    chips: [
      { label: "Find a collaborator", prompt: "Find me a videographer in my city.", icon: Search },
      { label: "Draft outreach DM", prompt: "Draft a warm outreach DM to a potential collaborator.", icon: Mail },
      { label: "Add to project", prompt: "Add a collaborator to my current project.", icon: Users },
    ],
  },
  {
    title: "Gigs & Opportunities",
    chips: [
      { label: "Match me to gigs", prompt: "Find gigs that match my skills.", icon: Briefcase },
      { label: "Write application", prompt: "Help me write a strong application for a gig.", icon: PenLine },
    ],
  },
  {
    title: "Profile & Credits",
    chips: [
      { label: "Strengthen profile", prompt: "What's missing from my profile?", icon: Sparkles },
      { label: "Better bio", prompt: "Suggest a stronger bio for me.", icon: PenLine },
      { label: "Add a credit", prompt: "Add a new credit to my profile.", icon: Award },
    ],
  },
  {
    title: "Events & Shoots",
    chips: [
      { label: "Run-of-show", prompt: "Build a run-of-show for my next shoot.", icon: Camera },
      { label: "Event kickoff post", prompt: "Write a kickoff post for my next event.", icon: Calendar },
      { label: "Recap last event", prompt: "Recap my last event for me.", icon: Calendar },
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (prompt: string) => void;
}

export const CopilotCapabilities = ({ open, onOpenChange, onPick }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border p-0 max-h-[85vh] flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            What can Kreto do?
          </SheetTitle>
          <SheetDescription className="text-xs">
            Tap any chip to run it now. Kreto already knows your projects, money, profile and events.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.chips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.label}
                      onClick={() => {
                        onPick(chip.prompt);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                        "border border-border bg-card text-xs font-medium text-foreground",
                        "hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Hook helper — use a controlled flag from parent.
export function useCopilotCapabilities() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
