import { ShieldCheck, Gauge, ArrowRight } from "lucide-react";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface Credit {
  verification_status?: string | null;
  endorsement_count?: number | null;
}

interface PassportCommandCenterProps {
  credits: Credit[];
  hasBio: boolean;
  hasAvatar: boolean;
  cosignCount: number;
  onReviewCredits: () => void;
  className?: string;
}

/**
 * Passport Command Center — personalized "what to do next" cards.
 *
 * SurfaceProactiveCards already covers Kreto-generated recommendations
 * (gig_match, passport_polish) via agent_proposals — reused here, not
 * duplicated. The two cards below are computed client-side from real
 * profile/credit data already loaded on this page; nothing is fabricated.
 *
 * Deliberately NOT included: "People to know" (no matching logic exists
 * in this codebase) and "Verify Identity" (no identity-verification
 * table/RPC exists) — building either here would mean inventing a fake
 * backend, which is explicitly out of scope.
 */
export function PassportCommandCenter({
  credits,
  hasBio,
  hasAvatar,
  cosignCount,
  onReviewCredits,
  className,
}: PassportCommandCenterProps) {
  const totalCredits = credits.length;
  const verifiedCount = credits.filter((c) => c.verification_status === "verified").length;
  const unconfirmedCount = credits.filter(
    (c) => (c.endorsement_count || 0) === 0 && c.verification_status !== "verified"
  ).length;

  // Passport Strength — completeness + evidence, not popularity. Every
  // input below is a real, already-loaded signal.
  const strength = Math.round(
    (hasBio ? 20 : 0) +
    (hasAvatar ? 15 : 0) +
    Math.min(totalCredits, 5) * 6 + // up to 30
    Math.min(verifiedCount, 3) * 10 + // up to 30
    Math.min(cosignCount, 1) * 5
  );

  return (
    <div className={cn("space-y-2.5", className)}>
      <SurfaceProactiveCards surface="passport" limit={2} />

      {unconfirmedCount > 0 && (
        <button
          type="button"
          onClick={() => { analytics.trustActionStarted('cosign'); onReviewCredits(); }}
          className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3.5 text-left hover:border-[hsl(var(--signal-teal))]/40 transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Turn claimed experience into trusted experience</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unconfirmedCount} credit{unconfirmedCount === 1 ? "" : "s"} could use a Co-Sign from a collaborator.
            </p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </button>
      )}

      <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Gauge className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
          <p className="text-sm font-medium">Passport Strength — {strength}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[hsl(var(--signal-teal))] transition-all"
            style={{ width: `${Math.min(strength, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Measures completeness and evidence, not popularity.
        </p>
      </div>
    </div>
  );
}

export default PassportCommandCenter;
