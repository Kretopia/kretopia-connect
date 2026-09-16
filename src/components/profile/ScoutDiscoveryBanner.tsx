import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScoutDiscoveryBannerProps {
  /** Show the banner — gated by the parent so it only appears right after a
   *  fresh claim/signup lands on the Passport, not on every visit. */
  show: boolean;
}

/**
 * "Scout already found opportunities for you" prompt -- shown alongside
 * ClaimContinueBanner right after a brand-new Passport is created, so the
 * very first thing a new user sees isn't just "here's your empty profile"
 * but a concrete reason to come back (Scout is already working for them).
 */
export const ScoutDiscoveryBanner = ({ show }: ScoutDiscoveryBannerProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[hsl(var(--energy)/0.25)] bg-gradient-to-r from-[hsl(var(--energy)/0.06)] to-card p-4 relative animate-in fade-in slide-in-from-top-2 duration-500">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[hsl(var(--energy)/0.15)] flex items-center justify-center shrink-0">
          <Radar className="h-5 w-5" style={{ color: "hsl(var(--energy))" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            Scout has already found opportunities for you.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gigs matched to what's already on your Passport — no extra setup needed.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => navigate("/opportunities")}
            >
              See my opportunities <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setDismissed(true)}
            >
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
