import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sun, AlertTriangle, Clock, Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; detail?: string; href: string; due?: string | null };
type Section = {
  key: "today" | "risks" | "followups" | "wins" | "opportunities";
  title: string;
  items: Item[];
};
type Briefing = {
  id: string;
  brief_date: string;
  sections: Section[];
  summary: string | null;
  task_count: number;
  risk_count: number;
  followup_count: number;
  generated_by: string;
  created_at: string;
};

const sectionIcon: Record<Section["key"], JSX.Element> = {
  today: <Clock className="w-3.5 h-3.5" />,
  risks: <AlertTriangle className="w-3.5 h-3.5" />,
  followups: <Sparkles className="w-3.5 h-3.5" />,
  wins: <Sparkles className="w-3.5 h-3.5" />,
  opportunities: <Sparkles className="w-3.5 h-3.5" />,
};

export function DailyBriefingCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchOrGenerate = async (force = false) => {
    if (!user?.id) return;
    setRefreshing(force);
    try {
      if (!force) {
        const { data } = await supabase
          .from("ep_daily_briefings")
          .select("*")
          .eq("user_id", user.id)
          .eq("brief_date", today)
          .maybeSingle();
        if (data) {
          setBriefing(data as unknown as Briefing);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("ep-daily-briefing", {
        body: {},
      });
      if (!error && data?.briefing) setBriefing(data.briefing as Briefing);
    } catch (e) {
      console.error("DailyBriefing fetch failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrGenerate(false).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading || !briefing) return null;
  const total =
    briefing.task_count + briefing.risk_count + briefing.followup_count;
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 accent-scout",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--signal-yellow)/0.15)] flex items-center justify-center shrink-0">
          <Sun className="w-4.5 h-4.5 text-[hsl(var(--signal-yellow))]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Today's brief from your EP
            </p>
            <button
              onClick={() => fetchOrGenerate(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Refresh briefing"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
          <p className="text-sm text-foreground mt-1 leading-snug">
            {briefing.summary ??
              `${briefing.task_count} on deck · ${briefing.risk_count} risk${
                briefing.risk_count === 1 ? "" : "s"
              } · ${briefing.followup_count} follow-up${
                briefing.followup_count === 1 ? "" : "s"
              }`}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {briefing.task_count > 0 && (
              <Chip
                label={`${briefing.task_count} on deck`}
                icon={sectionIcon.today}
                active={expanded}
                onClick={() => setExpanded((v) => !v)}
              />
            )}
            {briefing.risk_count > 0 && (
              <Chip
                label={`${briefing.risk_count} risk${briefing.risk_count === 1 ? "" : "s"}`}
                icon={sectionIcon.risks}
                tone="warn"
                active={expanded}
                onClick={() => setExpanded((v) => !v)}
              />
            )}
            {briefing.followup_count > 0 && (
              <Chip
                label={`${briefing.followup_count} follow-up${briefing.followup_count === 1 ? "" : "s"}`}
                icon={sectionIcon.followups}
                active={expanded}
                onClick={() => setExpanded((v) => !v)}
              />
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {briefing.sections.map((s) => (
                <div key={s.key}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5">
                    {sectionIcon[s.key]} {s.title}
                  </p>
                  <ul className="space-y-1">
                    {s.items.slice(0, 5).map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => navigate(item.href)}
                          className="w-full text-left flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="text-sm text-foreground block truncate">
                              {item.label}
                            </span>
                            {item.detail && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.detail}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  icon: JSX.Element;
  tone?: "warn";
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
        tone === "warn"
          ? "border-[hsl(var(--energy)/0.35)] text-[hsl(var(--energy))] bg-[hsl(var(--energy)/0.08)]"
          : "border-border text-foreground bg-muted/40 hover:bg-muted",
        active && "ring-1 ring-ring",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
