import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { decideAgentAction, type OrchAction } from "@/lib/agentOrchestrator";
import { personaFor } from "@/lib/agentPersonas";
import { riskPill, toolFriendly } from "@/lib/agentRiskUI";
import { cn } from "@/lib/utils";

interface Props {
  action: OrchAction;
  onResolved?: (status: "approved" | "rejected", result?: unknown) => void;
  compact?: boolean;
}

/**
 * Renders a proposed agent action with Approve / Dismiss controls.
 * Used wherever the orchestrator has queued up a Level-2 (requires_approval) action.
 */
export const AgentApprovalCard = ({ action, onResolved, compact }: Props) => {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const { toast } = useToast();

  if (action.status !== "proposed") return null;

  const handle = async (decision: "approved" | "rejected") => {
    setBusy(decision === "approved" ? "approve" : "reject");
    try {
      const res = await decideAgentAction(action.id, decision);
      if (!res.ok && decision === "approved") {
        toast({
          title: "Couldn't run that",
          description: res.error ?? "The agent action failed.",
          variant: "destructive",
        });
      } else if (decision === "approved") {
        toast({ title: "Done", description: action.preview_title ?? "Action completed." });
      }
      onResolved?.(decision, res.result);
    } catch (e) {
      toast({
        title: "Something went wrong",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const persona = personaFor(action.persona);
  const PersonaIcon = persona.icon;
  const risk = riskPill(action.risk_level);
  const friendly = toolFriendly(action.tool_name);

  // Visual confirmation block: when the planner attached a person to _preview
  // (avatar / subtitle), surface it so the user can verify "is this the right Dezii?"
  // before approving.
  const previewMeta = (action.tool_args as any)?._preview ?? {};
  const previewAvatar: string | null = previewMeta.avatar_url ?? null;
  const previewSubtitle: string | null = previewMeta.subtitle ?? null;
  const previewContextLine: string | null = previewMeta.context_line ?? null;
  const previewName: string | null =
    previewMeta.full_name ??
    (typeof action.preview_title === "string"
      ? action.preview_title.replace(/^(Add|Remove)\s+/i, "").split(/\s+(to|from)\s+/i)[0]
      : null);

  return (
    <Card className={`p-4 border-primary/30 bg-primary/5 ${compact ? "" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", persona.chipBg)}>
          <PersonaIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", persona.accent)}>
              {persona.label}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] py-0 h-4 shrink-0 border", risk.className)}
              title={risk.description}
            >
              {risk.label}
            </Badge>
          </div>
          <p className="text-base font-semibold leading-snug break-words mb-1">
            {action.preview_title ?? friendly.what}
          </p>
          {previewAvatar && (
            <div className="flex items-center gap-2 mt-2 mb-2 rounded-md border bg-background/60 px-2.5 py-2">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={previewAvatar} alt={previewName ?? "Person"} />
                <AvatarFallback>{(previewName ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {previewName && (
                  <p className="text-sm font-medium truncate">{previewName}</p>
                )}
                {previewSubtitle && (
                  <p className="text-xs text-muted-foreground truncate">{previewSubtitle}</p>
                )}
                {previewContextLine && (
                  <p className="text-[11px] text-muted-foreground/80 truncate">{previewContextLine}</p>
                )}
              </div>
            </div>
          )}
          {action.preview_body ? (
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {action.preview_body}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {friendly.what}
            </p>
          )}
          {friendly.why && (
            <p className="text-xs text-muted-foreground/80 mt-1.5">
              <span className="font-semibold text-foreground/70">Why: </span>{friendly.why}
            </p>
          )}
          <div className="flex gap-2 mt-2.5">
            <Button
              size="sm"
              className="h-8"
              onClick={() => handle("approved")}
              disabled={busy !== null}
            >
              {busy === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => handle("rejected")}
              disabled={busy !== null}
            >
              {busy === "reject" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
