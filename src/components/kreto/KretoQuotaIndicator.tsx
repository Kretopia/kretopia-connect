import { useEffect, useState } from "react";
import { loadAiCreditOverview, type AiCreditOverview } from "@/lib/thriveCopilot";

interface KretoQuotaIndicatorProps {
  /** Bump to re-read after a send completes. */
  refreshKey?: number;
}

/**
 * Compact read-out of what's left today: Kreto messages and tokens for the
 * signed-in user, against the global envelope. Renders nothing when signed
 * out or when the overview is unavailable — never an empty box, never an
 * error state in the composer.
 */
export function KretoQuotaIndicator({ refreshKey }: KretoQuotaIndicatorProps) {
  const [overview, setOverview] = useState<AiCreditOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAiCreditOverview()
      .then((o) => { if (!cancelled) setOverview(o); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!overview) return null;

  const messages = overview.mine.find((m) => m.feature === "kreto_message");
  const tokens = overview.mine.find((m) => m.feature === "kreto_tokens");
  const env = overview.envelope;

  const msgLeft = messages && messages.cap >= 0 ? Math.max(0, messages.cap - messages.used - messages.reserved) : null;
  const tokLeft = tokens && tokens.cap >= 0 ? Math.max(0, tokens.cap - tokens.used - tokens.reserved) : null;
  const envLeft = Math.max(0, env.credits_cap - env.credits_used - env.credits_reserved);
  const envPct = env.credits_cap > 0 ? Math.round((envLeft / env.credits_cap) * 100) : 0;

  const parts: string[] = [];
  if (msgLeft !== null) parts.push(`${msgLeft} messages left today`);
  if (tokLeft !== null) parts.push(`${Math.round(tokLeft / 1000)}k tokens`);
  parts.push(`Kretopia capacity ${envPct}%`);

  return (
    <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/35 font-semibold" aria-live="polite">
      {parts.join(" · ")}
    </p>
  );
}

export default KretoQuotaIndicator;
