import { Badge } from "@/components/ui/badge";
import { Film, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditScoreProps {
  totalCredits: number;
  verifiedCredits: number;
  awardsCount: number;
  portfolioCount: number;
  className?: string;
}

export const CreditScore = ({
  totalCredits,
  verifiedCredits,
  awardsCount,
  portfolioCount,
  className,
}: CreditScoreProps) => {
  // Calculate score: verified credits worth more, awards boost, portfolio adds
  const score = Math.min(100, 
    (verifiedCredits * 12) + 
    ((totalCredits - verifiedCredits) * 5) + 
    (awardsCount * 8) + 
    (Math.min(portfolioCount, 5) * 3)
  );

  const getScoreLabel = (s: number) => {
    if (s >= 80) return { label: "Industry Leader", color: "text-primary" };
    if (s >= 60) return { label: "Established Pro", color: "text-primary" };
    if (s >= 40) return { label: "Rising Talent", color: "text-accent" };
    if (s >= 20) return { label: "Building Profile", color: "text-muted-foreground" };
    return { label: "Getting Started", color: "text-muted-foreground" };
  };

  const { label, color } = getScoreLabel(score);

  if (totalCredits === 0 && awardsCount === 0) return null;

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-card border border-border", className)}>
      {/* Score Circle */}
      <div className="relative h-14 w-14 flex-shrink-0">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
          />
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 150.8} 150.8`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{score}</span>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className={cn("text-sm font-semibold", color)}>{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="h-5 text-[10px] gap-1">
            <Film className="h-3 w-3" />
            {totalCredits} Credits
          </Badge>
          {verifiedCredits > 0 && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
              <ShieldCheck className="h-3 w-3" />
              {verifiedCredits} Verified
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};
