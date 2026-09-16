import { ChevronRight, FolderPlus, Users, FileText, Receipt, CalendarPlus, RadioTower, Mail, DollarSign, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AgentResultCardData {
  id: string;
  icon?: "project" | "talent" | "invoice" | "quote" | "event" | "sponsor" | "outreach" | "money" | "generic";
  title: string;
  subtitle?: string;
  href?: string | null;
  cta?: string;
}

const iconFor = (kind: AgentResultCardData["icon"]) => {
  switch (kind) {
    case "project": return FolderPlus;
    case "talent": return Users;
    case "invoice": return Receipt;
    case "quote": return FileText;
    case "event": return CalendarPlus;
    case "sponsor": return RadioTower;
    case "outreach": return Mail;
    case "money": return DollarSign;
    default: return CheckCircle2;
  }
};

interface Props {
  card: AgentResultCardData;
  compact?: boolean;
  onOpen?: () => void;
}

/**
 * Tappable summary card the agent emits after a tool runs (e.g. "10 sponsors found").
 * Lives at the bottom of CopilotPlanCard when a plan completes.
 */
export const AgentResultCard = ({ card, compact, onOpen }: Props) => {
  const navigate = useNavigate();
  const Icon = iconFor(card.icon);
  const clickable = !!card.href;

  const openCard = () => {
    if (!card.href) return;
    navigate(card.href);
    onOpen?.();
  };

  const inner = (
    <div className={cn("flex items-center gap-3", compact ? "py-2" : "py-2.5")}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug truncate">{card.title}</p>
        {card.subtitle && (
          <p className="text-[11px] text-muted-foreground leading-snug truncate">{card.subtitle}</p>
        )}
      </div>
      {clickable && (
        <span className="text-[11px] font-medium text-primary inline-flex items-center gap-0.5 shrink-0">
          {card.cta ?? "Open"}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={openCard}
        className="block w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition-colors px-3"
      >
        {inner}
      </button>
    );
  }

  return (
    <Card className="rounded-xl border-border px-3">
      {inner}
    </Card>
  );
};
