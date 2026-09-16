import { useEffect, useState } from "react";
import { Sparkles, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { IntentPicker } from "@/components/intent/IntentPicker";
import { intentMeta, normalizeIntents, type PrimaryIntent } from "@/lib/intents";
import { useToast } from "@/hooks/use-toast";

/**
 * Weekly intent refresh — appears on Home if the user hasn't picked
 * (or refreshed) their focus this calendar week. Multi-select (max 2).
 */
export const WeeklyIntentCard = ({ className = "" }: { className?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<PrimaryIntent[]>([]);
  const [draft, setDraft] = useState<PrimaryIntent[]>([]);
  const [saving, setSaving] = useState(false);

  // Monday of current week as YYYY-MM-DD
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("primary_intent, primary_intents, intent_week_start")
          .eq("user_id", user.id)
          .maybeSingle();

        const intents = normalizeIntents(
          (data as any)?.primary_intents ?? (data as any)?.primary_intent
        );
        const lastWeek = (data as any)?.intent_week_start as string | null;
        setCurrent(intents);
        setDraft(intents);

        // Show prompt when: never picked, OR week has changed
        if (intents.length === 0 || lastWeek !== weekStart) {
          setShow(true);
          if (intents.length === 0) setEditing(true);
        }
      } catch (e) {
        console.error("[WeeklyIntentCard]", e);
      }
    };
    load().catch((e) => console.error("[WeeklyIntentCard] load", e));
  }, [user, weekStart]);

  const save = async () => {
    if (!user || draft.length === 0) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({
          primary_intents: draft,
          primary_intent: draft[0],
          intent_set_at: new Date().toISOString(),
          intent_week_start: weekStart,
        } as any)
        .eq("user_id", user.id);
      setCurrent(draft);
      setEditing(false);
      const labels = draft.map((d) => intentMeta(d)?.short).filter(Boolean).join(" + ");
      toast({
        title: `Locked in: ${labels}`,
        description: "We'll tune your home and nudges around this.",
      });
    } catch (e) {
      console.error("[WeeklyIntentCard] save", e);
      toast({ title: "Couldn't save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user || !show) return null;

  return (
    <div
      className={`relative rounded-2xl border border-energy/30 bg-gradient-to-br from-energy/[0.06] via-card to-primary/[0.05] p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-energy/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-energy" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">
              {editing ? "What's your focus this week?" : "Your focus this week"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {editing ? "Pick up to 2 — we'll tune your home around it." : "Tap to switch any time."}
            </p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => { setDraft(current); setEditing(true); }}
            className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" /> Change
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <IntentPicker value={draft} onChange={setDraft} compact />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || draft.length === 0}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {saving ? "Saving…" : "Lock it in"}
            </button>
            {current.length > 0 && (
              <button
                onClick={() => { setDraft(current); setEditing(false); }}
                className="px-4 h-10 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : current.length > 0 ? (
        <button
          onClick={() => { setDraft(current); setEditing(true); }}
          className="w-full flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 hover:bg-primary/15 transition-colors text-left"
        >
          {current.map((id) => {
            const meta = intentMeta(id);
            if (!meta) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 text-[13px] font-bold">
                <span aria-hidden>{meta.emoji}</span>
                <span>{meta.short}</span>
              </span>
            );
          })}
        </button>
      ) : null}
    </div>
  );
};
