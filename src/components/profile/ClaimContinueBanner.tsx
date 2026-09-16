import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Plus, Award, FileText, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClaimContinueBannerProps {
  onRefresh?: () => void;
  /** Set when the user just landed here via a claim-flow magic link
   *  (?claimed=true). sessionStorage doesn't survive that trip if the link
   *  is opened on a different tab/device, so this is the reliable trigger --
   *  `show_claim_continue` below is a same-tab bonus, not the primary path. */
  justClaimed?: boolean;
}

export const ClaimContinueBanner = ({ onRefresh, justClaimed }: ClaimContinueBannerProps) => {
  const navigate = useNavigate();
  const [claimInfo, setClaimInfo] = useState<{ name: string; count: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('show_claim_continue');
    if (raw) {
      try {
        setClaimInfo(JSON.parse(raw));
      } catch { /* ignore */ }
      sessionStorage.removeItem('show_claim_continue');
    }
  }, []);

  if (dismissed || (!claimInfo && !justClaimed)) return null;

  // "Your Passport is ready. Want to make it even stronger?" prompt when we
  // only know a fresh claim happened (magic-link path) with no session-carried
  // credit count; the richer "N credits found" copy still wins when we have it.
  if (!claimInfo) {
    return (
      <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-4 relative animate-in fade-in slide-in-from-top-2 duration-500">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">
              Your Passport is ready. Want to make it even stronger?
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  const el = document.getElementById('work-history-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else navigate('/profile#work-history');
                }}
              >
                <Plus className="h-3 w-3" /> Add projects
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  const el = document.getElementById('work-history-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Award className="h-3 w-3" /> Add skills
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  const el = document.getElementById('profile-header-section') || document.getElementById('work-history-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <MapPin className="h-3 w-3" /> Set your city
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setDismissed(true)}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-4 relative animate-in fade-in slide-in-from-top-2 duration-500">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            {claimInfo.count > 0
              ? `${claimInfo.count} potential credit${claimInfo.count !== 1 ? 's' : ''} found`
              : `Welcome, ${claimInfo.name}!`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {claimInfo.count > 0
              ? "Review and confirm them below to add them to your Passport."
              : "Keep building your verified profile — add more credits, awards, and press links."}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const el = document.getElementById('work-history-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/profile#work-history');
              }}
            >
              <Plus className="h-3 w-3" /> Add More Credits
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const el = document.getElementById('awards-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Award className="h-3 w-3" /> Add Awards
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const el = document.getElementById('press-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <FileText className="h-3 w-3" /> Add Press
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
