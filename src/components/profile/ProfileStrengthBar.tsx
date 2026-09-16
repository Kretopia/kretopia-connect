import { Link } from "react-router-dom";
import { Zap, ArrowRight } from "lucide-react";
import { calculateProfileStrength } from "@/components/profile/ProfileStrengthScore";
import { cn } from "@/lib/utils";

interface Props {
  profile: any;
  portfolioCount?: number;
  creditsCount?: number;
  awardsCount?: number;
  pressCount?: number;
  className?: string;
}

/**
 * Slim Duolingo-style progress bar pinned at top of own profile.
 * One tap → next missing field.
 */
export function ProfileStrengthBar({
  profile,
  portfolioCount = 0,
  creditsCount = 0,
  awardsCount = 0,
  pressCount = 0,
  className,
}: Props) {
  if (!profile) return null;
  const { score, items } = calculateProfileStrength(
    profile,
    portfolioCount,
    creditsCount,
    awardsCount,
    pressCount,
  );
  if (score >= 100) return null;

  const next = items.find((i) => !i.completed);
  const tone =
    score >= 80
      ? "from-emerald-500 to-emerald-400"
      : score >= 50
        ? "from-warning to-warning/80"
        : "from-primary to-energy";

  return (
    <Link
      to="/profile/edit"
      className={cn(
        "block rounded-xl border border-border/60 bg-card p-3 hover:border-primary/40 transition-colors",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-bold truncate">
            Profile {score}%
            {next && <span className="text-muted-foreground font-medium ml-1">· {next.label}</span>}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-700", tone)}
          style={{ width: `${score}%` }}
        />
      </div>
    </Link>
  );
}
