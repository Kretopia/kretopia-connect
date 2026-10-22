import { Link } from "react-router-dom";
import { ArrowRight, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { analytics } from "@/lib/analytics";
import type { Standing } from "@/lib/passport/standing";
import { PassportMomentum } from "./PassportMomentum";
import { RecentlyWorkedWith } from "./RecentlyWorkedWith";
import { ThriveRemembersChip } from "./ThriveRemembersChip";

interface Credit {
  verification_status?: string | null;
  endorsement_count?: number | null;
}

interface PassportOverviewProps {
  userId: string;
  credits: Credit[];
  verified: number;
  cosigns: number;
  standing: Standing;
  onReviewCredits: () => void;
}

/** One compact, data-driven surface for next steps, trust and the full record. */
export function PassportOverview({ userId, credits, verified, cosigns, standing, onReviewCredits }: PassportOverviewProps) {
  const needsCosign = credits.filter((credit) => (credit.endorsement_count || 0) === 0 && credit.verification_status !== "verified").length;

  return (
    <section aria-label="Passport overview" className="relative mt-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-foreground"><Fingerprint className="h-4 w-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Passport intelligence</h3>
            <p className="text-[11px] text-muted-foreground">Your next move and your creative record</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/credits">Your record <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
        {[
          { label: "Verified", value: verified },
          { label: "Credits", value: credits.length },
          { label: "Co-signs", value: cosigns },
        ].map(({ label, value }) => (
          <div key={label} className="px-2 py-3">
            <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-foreground" /> Kreto's next move
        </div>
        <SurfaceProactiveCards surface="passport" limit={1} className="px-0" />
        {needsCosign > 0 && (
          <Button variant="outline" className="h-auto w-full justify-between gap-2 whitespace-normal py-2.5 text-left text-xs" onClick={() => { analytics.trustActionStarted("cosign"); onReviewCredits(); }}>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-foreground" />{needsCosign} credit{needsCosign === 1 ? "" : "s"} awaiting a co-sign</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        )}
        {standing.nextActions[0] && (
          <Button asChild variant="ghost" className="h-auto w-full justify-between gap-2 whitespace-normal py-2.5 text-left text-xs">
            <Link to={standing.nextActions[0].deeplink}><span>{standing.nextActions[0].label}</span><ArrowRight className="h-4 w-4 shrink-0" /></Link>
          </Button>
        )}
        <div className="space-y-3 border-t border-border pt-3">
          <PassportMomentum userId={userId} compact />
          <RecentlyWorkedWith userId={userId} compact />
          <ThriveRemembersChip />
        </div>
      </div>
    </section>
  );
}