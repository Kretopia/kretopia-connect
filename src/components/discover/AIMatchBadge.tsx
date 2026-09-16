import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AIMatchBadgeProps {
  score: number;
  size?: "sm" | "md";
  showLocked?: boolean;
}

export const AIMatchBadge = ({ score, size = "md", showLocked = false }: AIMatchBadgeProps) => {
  const getMatchLabel = (score: number) => {
    if (score >= 85) return "Perfect Match";
    if (score >= 70) return "Great Match";
    if (score >= 60) return "Good Match";
    return "Potential Match";
  };

  const getMatchColor = (score: number) => {
    if (score >= 85) return "bg-gradient-to-r from-green-500 to-emerald-500";
    if (score >= 70) return "bg-gradient-to-r from-primary to-accent";
    if (score >= 60) return "bg-primary";
    return "bg-gradient-to-r from-gray-500 to-slate-500";
  };

  if (showLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"} border-primary/30 bg-primary/10 cursor-help`}
          >
            <Lock className={`${size === "sm" ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
            Smart Match
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">Upgrade to Creator+ for unlimited match scores</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge 
      className={`${getMatchColor(score)} text-white ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"} shadow-lg`}
    >
      <Sparkles className={`${size === "sm" ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
      {score}% • {getMatchLabel(score)}
    </Badge>
  );
};