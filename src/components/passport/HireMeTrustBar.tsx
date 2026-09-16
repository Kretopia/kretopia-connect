import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, DollarSign, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HireMeTrustBar — three trust chips for the Hire-Me funnel:
 *   1. Avg response time (last 30d of replies, fallback to profiles.avg_response_hours)
 *   2. Rate confidence (# of paid invoices in last 12mo → Indicative / Market-tested / Repeat-booked)
 *   3. Availability (open-to-work flag → "Booking now")
 *
 * Goal: shrink the gap between "I like this Passport" and "I'll DM/book".
 * Pure visual signal — no DB writes.
 */
interface Props {
  userId: string;
  avgResponseHours?: number | null;
  hourlyRate?: number | null;
  projectRate?: number | null;
  rateCurrency?: string | null;
  collabIntent?: string | null;
  className?: string;
}

type Confidence = "indicative" | "market" | "repeat";

export function HireMeTrustBar({
  userId,
  avgResponseHours,
  hourlyRate,
  projectRate,
  rateCurrency,
  collabIntent,
  className,
}: Props) {
  const [responseLabel, setResponseLabel] = useState<string | null>(
    avgResponseHours != null ? formatResponse(Number(avgResponseHours)) : null
  );
  const [confidence, setConfidence] = useState<Confidence>("indicative");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    // Pull a sample of recent inbound + outbound messages to estimate reply time.
    (async () => {
      try {
        const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: msgs } = await supabase
          .from("messages")
          .select("sender_id, receiver_id, created_at, match_id")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: true })
          .limit(500)
          .then((r) => r, () => ({ data: null } as any));

        if (msgs && msgs.length > 0) {
          const byConv = new Map<string, any[]>();
          for (const m of msgs as any[]) {
            const k = m.match_id || `${m.sender_id}:${m.receiver_id}`;
            if (!byConv.has(k)) byConv.set(k, []);
            byConv.get(k)!.push(m);
          }
          const replyMs: number[] = [];
          for (const arr of byConv.values()) {
            for (let i = 1; i < arr.length; i++) {
              const prev = arr[i - 1];
              const curr = arr[i];
              if (prev.sender_id !== userId && curr.sender_id === userId) {
                const dt = +new Date(curr.created_at) - +new Date(prev.created_at);
                if (dt > 0 && dt < 7 * 24 * 60 * 60 * 1000) replyMs.push(dt);
              }
            }
          }
          if (replyMs.length >= 3) {
            const median = replyMs.sort((a, b) => a - b)[Math.floor(replyMs.length / 2)];
            const hours = median / (60 * 60 * 1000);
            if (!cancelled) setResponseLabel(formatResponse(hours));
          }
        }
      } catch {/* silent */}

      // Rate confidence — based on paid invoices in last 12 months.
      try {
        const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await (supabase as any)
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", userId)
          .eq("status", "paid")
          .gte("paid_at", since)
          .then((r: any) => r, () => ({ count: 0 }));

        if (!cancelled) {
          if ((count || 0) >= 5) setConfidence("repeat");
          else if ((count || 0) >= 1) setConfidence("market");
        }
      } catch {/* silent */}
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const rateString = formatRate(hourlyRate, projectRate, rateCurrency);
  const isBooking = collabIntent === "seeking_collaborators" || collabIntent === "open_to_work" || collabIntent === "available";

  const chips: { icon: any; label: string; sub: string; tone: "teal" | "yellow" | "green" }[] = [];

  if (responseLabel) {
    chips.push({ icon: Clock, label: responseLabel, sub: "Replies", tone: "teal" });
  }
  if (rateString) {
    chips.push({
      icon: DollarSign,
      label: rateString,
      sub: confidence === "repeat" ? "Repeat-booked" : confidence === "market" ? "Market-tested" : "Indicative",
      tone: confidence === "indicative" ? "teal" : "green",
    });
  }
  if (isBooking) {
    chips.push({ icon: CheckCircle2, label: "Booking now", sub: "Open this month", tone: "green" });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("grid gap-2", chips.length === 1 ? "grid-cols-1" : chips.length === 2 ? "grid-cols-2" : "grid-cols-3", className)}>
      {chips.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="rounded-xl border border-border bg-card px-3 py-2.5 flex flex-col gap-0.5"
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                c.tone === "teal" && "text-[hsl(var(--signal-teal))]",
                c.tone === "yellow" && "text-[hsl(var(--signal-amber))]",
                c.tone === "green" && "text-[hsl(var(--money-green,142_71%_45%))]"
              )}
            />
            <div className="text-sm font-bold leading-tight truncate">{c.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none flex items-center gap-1">
              {c.sub === "Repeat-booked" && <ShieldCheck className="h-3 w-3 text-[hsl(var(--money-green,142_71%_45%))]" />}
              {c.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatResponse(hours: number): string {
  if (hours < 1) return `< 1 hr`;
  if (hours < 24) return `${Math.round(hours)} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatRate(hourly?: number | null, project?: number | null, currency?: string | null): string | null {
  const cur = currency || "USD";
  const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : "";
  if (hourly && hourly > 0) return `${sym}${Math.round(Number(hourly))}/hr`;
  if (project && project > 0) return `${sym}${Math.round(Number(project)).toLocaleString()}/project`;
  return null;
}

export default HireMeTrustBar;
