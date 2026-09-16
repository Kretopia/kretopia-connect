import { Briefcase, Eye, User, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentRoleInfo } from "@/hooks/useAgentRole";

interface AgentModeBannerProps {
  agentRole: AgentRoleInfo;
}

const ROLE_META: Record<string, { label: string; sub: string; icon: typeof User; tone: string }> = {
  manager: {
    label: "You're the Manager",
    sub: "You see the full picture — client price, payouts, and margin.",
    icon: Briefcase,
    tone: "bg-primary/15 text-primary border-primary/30",
  },
  client: {
    label: "You're the Client",
    sub: "You see only what you're paying for this project.",
    icon: User,
    tone: "bg-accent/15 text-accent border-accent/30",
  },
  creative: {
    label: "You're the Creative",
    sub: "You see only your scope and what you're getting paid.",
    icon: Sparkles,
    tone: "bg-secondary/15 text-secondary-foreground border-secondary/30",
  },
  observer: {
    label: "Observer view",
    sub: "Limited visibility — financial details are hidden.",
    icon: Eye,
    tone: "bg-muted text-muted-foreground border-border",
  },
};

export function AgentModeBanner({ agentRole }: AgentModeBannerProps) {
  if (!agentRole.isAgentMode) return null;
  const meta = ROLE_META[agentRole.role] ?? ROLE_META.observer;
  const Icon = meta.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 border-b text-xs",
      meta.tone
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{meta.label}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-current">
            Agent Mode
          </Badge>
        </div>
        <p className="opacity-80 truncate">{meta.sub}</p>
      </div>
    </div>
  );
}
