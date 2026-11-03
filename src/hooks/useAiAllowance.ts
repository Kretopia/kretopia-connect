import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAiCreditOverview, type AiCreditOverview } from "@/lib/thriveCopilot";
import { allowanceFrom, type Allowance } from "@/lib/aiAllowance";

const TICK_MS = 30_000;

/**
 * Today's Kreto allowance for the signed-in person, from the server's overview, with a clock that keeps "resets in 5 h 12 min" true. When
 * the reset passes while the page is open it reads the overview again, so a blocked composer comes back on its own.
 * `refreshKey`: bump it to read again (after a send).
 */
export function useAiAllowance(refreshKey?: number): { allowance: Allowance | null; now: Date; refresh: () => void } {
  const [overview, setOverview] = useState<AiCreditOverview | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [manual, setManual] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAiCreditOverview()
      .then((o) => {
        if (!cancelled) setOverview(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey, manual]);

  const allowance = useMemo(() => allowanceFrom(overview, now), [overview, now]);
  const resetTime = allowance?.resetsAt.getTime();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // The server's day has turned over since the overview was read: ask again.
  useEffect(() => {
    if (allowance?.blocked && resetTime !== undefined && now.getTime() >= resetTime) setManual((n) => n + 1);
  }, [allowance?.blocked, resetTime, now]);

  const refresh = useCallback(() => setManual((n) => n + 1), []);
  return { allowance, now, refresh };
}
