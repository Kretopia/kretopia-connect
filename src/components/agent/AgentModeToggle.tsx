import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Domain =
  | "agent_mode_projects"
  | "agent_mode_talent"
  | "agent_mode_payments"
  | "agent_mode_credits";

interface Props {
  domain?: Domain;
  title?: string;
  description?: string;
}

/**
 * Per-domain Agent Mode switch. Writes to public.orch_settings (per-user).
 * When ON, the orchestrator may queue Level-2 follow-ups (still need user approval)
 * for that domain. Level-3 (locked) actions are never auto-proposed.
 */
export function AgentModeToggle({
  domain = "agent_mode_projects",
  title = "Agent Mode",
  description = "Let the Copilot draft follow-ups, nudges and recaps. You always approve before anything is sent.",
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("orch_settings")
        .select(domain)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setEnabled(Boolean(data?.[domain]));
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, domain]);

  const onChange = async (next: boolean) => {
    if (!user) return;
    setSaving(true);
    setEnabled(next);
    try {
      const { error } = await (supabase as any)
        .from("orch_settings")
        .upsert(
          { user_id: user.id, [domain]: next },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      toast({
        title: next ? "Agent Mode on" : "Agent Mode off",
        description: next
          ? "The Copilot will start proposing helpful follow-ups."
          : "Auto-proposals are paused for this area.",
      });
    } catch (e) {
      setEnabled(!next);
      toast({
        title: "Couldn't update",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`agent-mode-${domain}`} className="text-sm font-semibold cursor-pointer">
            {title}
          </Label>
          {loading || saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id={`agent-mode-${domain}`}
              checked={enabled}
              onCheckedChange={onChange}
              disabled={saving}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
