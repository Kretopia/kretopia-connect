import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PERSONAS, type AgentPersona } from "@/lib/agentPersonas";
import { cn } from "@/lib/utils";

interface PersonaCardData {
  persona: AgentPersona;
  count: number;
  headline: string;
  body: string;
  ctaLabel: string;
  to: string;
}

interface Props {
  className?: string;
}

/**
 * Three persona cards at the top of Home: Scout (gigs), Deal (money),
 * Producer (clips/episodes). Mobile-first horizontal scroll on small
 * screens, 3-up grid on lg+. Cards only render when they have signal.
 */
export const PersonaCardsRow = ({ className }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<PersonaCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const safe = async <T,>(p: PromiseLike<T>): Promise<T | { data: any[]; count: number }> => {
        try { return await p; } catch { return { data: [], count: 0 } as any; }
      };

      const [scoutRes, dealRes, clipsRes, orchRes] = await Promise.all([
        safe(
          supabase
            .from("scouted_gigs")
            .select("id, title", { count: "exact" })
            .eq("target_user_id", user.id)
            .gt("expires_at", new Date().toISOString())
            .order("scouted_at", { ascending: false })
            .limit(3),
        ),
        safe(
          supabase
            .from("invoices")
            .select("id, invoice_number, status", { count: "exact" })
            .eq("issued_by", user.id)
            .in("status", ["draft", "sent", "overdue"])
            .order("updated_at", { ascending: false })
            .limit(3),
        ),
        safe(
          supabase
            .from("episode_clips")
            .select("id, title, project_id", { count: "exact" })
            .eq("created_by", user.id)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(3),
        ),
        safe(
          (supabase as any)
            .from("orch_actions")
            .select("id, persona, preview_title")
            .eq("user_id", user.id)
            .eq("status", "proposed")
            .order("proposed_at", { ascending: false })
            .limit(10),
        ),
      ]);

      if (cancelled) return;

      const scoutGigs = (scoutRes as any).data || [];
      const scoutCount = (scoutRes as any).count ?? scoutGigs.length;
      const draftInvoices = (dealRes as any).data || [];
      const dealCount = (dealRes as any).count ?? draftInvoices.length;
      const clips = (clipsRes as any).data || [];
      const clipsCount = (clipsRes as any).count ?? clips.length;
      const orch = (orchRes as any).data || [];

      const orchByPersona = (p: AgentPersona) =>
        orch.filter((a: any) => a.persona === p).length;

      const next: PersonaCardData[] = [];

      // Scout — pending scouted gigs OR scout-tagged orch actions
      const scoutPending = scoutCount + orchByPersona("scout");
      if (scoutPending > 0) {
        const sample = scoutGigs[0]?.title;
        next.push({
          persona: "scout",
          count: scoutPending,
          headline: `${scoutPending} new ${scoutPending === 1 ? "opportunity" : "opportunities"}`,
          body: sample
            ? `${sample}${scoutGigs.length > 1 ? ` + ${scoutGigs.length - 1} more` : ""}`
            : "Fresh leads matched to you.",
          ctaLabel: "See gigs",
          to: "/gigs",
        });
      }

      // Deal — drafts/unpaid invoices + deal orch actions
      const dealPending = dealCount + orchByPersona("deal");
      if (dealPending > 0) {
        const drafts = draftInvoices.filter((i: any) => i.status === "draft").length;
        const sent = draftInvoices.filter((i: any) => i.status !== "draft").length;
        const body =
          drafts && sent
            ? `${drafts} draft · ${sent} awaiting payment`
            : drafts
              ? `${drafts} draft invoice${drafts > 1 ? "s" : ""} ready to send`
              : `${sent} invoice${sent > 1 ? "s" : ""} awaiting payment`;
        next.push({
          persona: "deal",
          count: dealPending,
          headline: `${dealPending} money move${dealPending === 1 ? "" : "s"}`,
          body,
          ctaLabel: "Open Pay",
          to: "/thrivepay",
        });
      }

      // Producer — fresh clips + producer orch actions
      const prodPending = clipsCount + orchByPersona("producer");
      if (prodPending > 0) {
        const projectId = clips[0]?.project_id;
        next.push({
          persona: "producer",
          count: prodPending,
          headline: `${clipsCount > 0 ? `${clipsCount} clip${clipsCount > 1 ? "s" : ""} ready` : `${prodPending} producer task${prodPending === 1 ? "" : "s"}`}`,
          body: clipsCount
            ? "Review, caption, and post your latest cuts."
            : "Your producer queued up next steps.",
          ctaLabel: clipsCount ? "Review clips" : "Open Studio",
          to: projectId ? `/projects/${projectId}?tab=podcast` : "/projects",
        });
      }

      setCards(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || loading || cards.length === 0) return null;

  return (
    <section
      className={cn("-mx-1", className)}
      aria-label="Today's signal from your operators"
    >
      <div className="px-1 mb-2 flex items-baseline justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          On your desk today
        </h2>
      </div>

      <div
        className={cn(
          "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 px-1 scrollbar-none",
          "lg:grid lg:grid-cols-3 lg:overflow-visible lg:snap-none",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((c) => {
          const meta = PERSONAS[c.persona];
          const Icon = meta.icon;
          return (
            <button
              key={c.persona}
              type="button"
              onClick={() => navigate(c.to)}
              className={cn(
                "snap-start shrink-0 w-[78%] sm:w-[60%] lg:w-auto",
                "text-left rounded-2xl border border-border/70 bg-card p-3.5",
                "transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]",
                "active:scale-[0.99]",
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center",
                    meta.chipBg,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-[0.22em]", meta.accent)}>
                  {meta.label}
                </span>
              </div>
              <p className="text-[15px] font-bold leading-tight text-foreground">
                {c.headline}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
                {c.body}
              </p>
              <div className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-foreground">
                {c.ctaLabel}
                <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
