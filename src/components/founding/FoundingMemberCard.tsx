import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, X, ChevronRight } from "lucide-react";
import { useFoundingMemberProgress } from "@/hooks/useFoundingMemberProgress";
import { FOUNDING_QUESTS, foundingDeadlineLabel } from "@/lib/foundingMember";

const DISMISS_KEY = "founding-member-card-dismissed-v1";

interface Props {
  className?: string;
  /** Compact variant for the profile sidebar / verification stack. */
  compact?: boolean;
}

export const FoundingMemberCard = ({ className, compact }: Props) => {
  const { loading, progress, completedCount, allComplete } = useFoundingMemberProgress();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  // Hide entirely after the program is earned + acknowledged
  if (loading) return null;
  if (allComplete && dismissed) return null;

  const total = FOUNDING_QUESTS.length;
  const pct = Math.round((completedCount / total) * 100);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <Card
      className={`relative overflow-hidden border-[hsl(var(--signal-teal))]/30 bg-card ${className ?? ""}`}
    >
      {allComplete && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <Link to="/founding-member" className="block p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-[hsl(var(--signal-teal))]/15 flex items-center justify-center shrink-0">
            <Star className="h-4 w-4 text-[hsl(var(--signal-teal))]" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">
                {allComplete ? "Founding Member earned" : "Founding Member"}
              </p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allComplete
                ? "Your badge is on your profile."
                : compact
                  ? `${completedCount}/${total} done · closes ${foundingDeadlineLabel()}`
                  : `Complete 3 milestones before ${foundingDeadlineLabel()} to earn the badge.`}
            </p>
            {!allComplete && (
              <div className="mt-2.5">
                <Progress value={pct} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {completedCount} of {total} complete
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default FoundingMemberCard;
