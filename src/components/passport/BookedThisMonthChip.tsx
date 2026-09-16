import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BookedThisMonthChip — social-proof chip showing how many paid
 * invoices / approved credits this creator booked in the current calendar
 * month. Renders nothing when there's nothing to brag about (0).
 *
 * Public-safe: only counts published, paid invoices the user issued.
 */
export function BookedThisMonthChip({
  userId,
  className,
  variant = "dark",
}: {
  userId?: string;
  className?: string;
  variant?: "dark" | "light";
}) {
  const [count, setCount] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const cutoff = monthStart.toISOString();

      const invoicesP = (supabase as any)
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("issued_by", userId)
        .eq("status", "paid")
        .gte("paid_at", cutoff)
        .then((r: any) => r.count || 0, () => 0);

      const creditsP = (supabase as any)
        .from("credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("verification_status", "verified")
        .gte("created_at", cutoff)
        .then((r: any) => r.count || 0, () => 0);

      const [paid, stamps] = await Promise.all([invoicesP, creditsP]);
      if (cancelled) return;
      // Prefer paid bookings; fall back to verified stamps so new creators
      // who run on co-signs still get the proof signal.
      setCount(paid > 0 ? paid : stamps);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!loaded || count === 0) return null;

  const palette = variant === "light"
    ? "bg-[hsl(var(--signal-teal))]/12 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40"
    : "bg-[hsl(var(--signal-teal))]/20 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40 backdrop-blur-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        palette,
        className,
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      Booked {count}× this month
    </span>
  );
}

export default BookedThisMonthChip;
