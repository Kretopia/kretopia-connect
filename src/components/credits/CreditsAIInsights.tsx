import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, Check, X, Pencil, Info } from "lucide-react";
import { toast } from "sonner";
import { DashboardPanel, CreditsEmptyState } from "./CreditsPrimitives";
import { cn } from "@/lib/utils";

/**
 * CreditsAIInsights — Kreto's review of the caller's OWN record.
 *
 * Guarantees enforced here and in `credits-ai-insights`:
 *  - AI reads only the caller's own credits/profile (auth-derived server-side).
 *  - AI never writes. Accepting a suggestion writes ONE allow-listed profile
 *    text field (bio / site_headline / availability_note) after the human has
 *    read it, optionally edited it, and pressed Accept.
 *  - Verification status, stamps, XP, badges and payment fields are untouchable.
 */

interface Insight {
  id: string;
  kind: string;
  title: string;
  body: string;
  reason: string;
  confidence: "low" | "medium" | "high";
  draft: string | null;
  target_field: "bio" | "site_headline" | "availability_note" | "none";
}

const CONFIDENCE_COPY: Record<string, string> = {
  high: "Confident — based on clear signals in your record",
  medium: "Fairly sure — your record is partly filled in",
  low: "A hunch — there isn't much data to go on yet",
};

const WRITABLE_FIELDS = ["bio", "site_headline", "availability_note"] as const;

export function CreditsAIInsights({
  userId,
  onApplied,
  index,
}: {
  userId: string;
  onApplied?: () => void;
  index?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [scope, setScope] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setDegraded(null);
    try {
      const { data, error } = await supabase.functions.invoke("credits-ai-insights", { body: {} });
      if (error) throw error;
      setSummary(data?.summary || "");
      setInsights(Array.isArray(data?.insights) ? data.insights : []);
      setScope(Array.isArray(data?.scope) ? data.scope : []);
      setGeneratedAt(data?.generated_at || new Date().toISOString());
      if (data?.degraded) setDegraded(data?.reason || "unavailable");
    } catch {
      setDegraded("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run().catch(() => setDegraded("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dismiss = (id: string) => setInsights((prev) => prev.filter((i) => i.id !== id));

  const accept = async (insight: Insight) => {
    const field = insight.target_field;
    if (!WRITABLE_FIELDS.includes(field as any)) {
      dismiss(insight.id);
      toast.success("Noted — nothing was changed automatically.");
      return;
    }
    const value = (editing[insight.id] ?? insight.draft ?? "").trim();
    if (!value) {
      toast.error("Nothing to save — add some text first.");
      return;
    }
    setSaving(insight.id);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value } as any)
      .eq("user_id", userId);
    setSaving(null);
    if (error) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    toast.success(`Saved to your ${field.replace(/_/g, " ")}.`);
    dismiss(insight.id);
    onApplied?.();
  };

  return (
    <DashboardPanel
      id="insights"
      eyebrow="05"
      title="What to do next"
      index={index}
      action={
        <button
          type="button"
          onClick={() => run()}
          disabled={loading}
          className="btn-glass btn-glass-outline inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <Sparkles className="h-3 w-3" aria-hidden />
          Kreto-generated
        </span>
        {generatedAt && (
          <time dateTime={generatedAt} className="normal-case tracking-normal text-muted-foreground">
            {new Date(generatedAt).toLocaleString()}
          </time>
        )}
        {scope.length > 0 && (
          <span className="normal-case tracking-normal text-muted-foreground">Read: {scope.join(", ")}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          <span className="sr-only">Kreto is reading your record…</span>
          <div className="h-16 animate-pulse rounded-xl bg-muted/30" />
          <div className="h-16 animate-pulse rounded-xl bg-muted/30" />
        </div>
      ) : degraded ? (
        <CreditsEmptyState
          title="Kreto can't read your record right now"
          body="Everything else on this page still works. Try refreshing in a moment."
        />
      ) : (
        <>
          {summary && <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{summary}</p>}
          {insights.length === 0 ? (
            <CreditsEmptyState
              title="Nothing to suggest yet"
              body="Add a credit or fill in your identity and Kreto will have something useful to say."
            />
          ) : (
            <ul className="space-y-3">
              {insights.map((i) => {
                const canEdit = WRITABLE_FIELDS.includes(i.target_field as any) && i.draft !== null;
                return (
                  <li key={i.id} className="rounded-xl border border-border bg-muted/30 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{i.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{i.body}</p>

                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [i.id]: !p[i.id] }))}
                      aria-expanded={!!expanded[i.id]}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground/80"
                    >
                      <Info className="h-3 w-3" aria-hidden />
                      Why Kreto says this
                    </button>
                    {expanded[i.id] && (
                      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                        <p>{i.reason}</p>
                        <p className="mt-1.5 text-muted-foreground">{CONFIDENCE_COPY[i.confidence]}</p>
                      </div>
                    )}

                    {canEdit && (
                      <div className="mt-3">
                        <label htmlFor={`draft-${i.id}`} className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          Editable draft for your {i.target_field.replace(/_/g, " ")}
                        </label>
                        <textarea
                          id={`draft-${i.id}`}
                          value={editing[i.id] ?? i.draft ?? ""}
                          maxLength={600}
                          rows={3}
                          onChange={(e) => setEditing((p) => ({ ...p, [i.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => accept(i)}
                        disabled={saving === i.id}
                        className="btn-glass btn-glass-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {canEdit ? "Accept and save" : "Mark as done"}
                      </button>
                      {canEdit && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Pencil className="h-3 w-3" aria-hidden />
                          Edit before saving — nothing is written until you accept
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => dismiss(i.id)}
                        className="btn-glass btn-glass-outline ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Dismiss
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </DashboardPanel>
  );
}
