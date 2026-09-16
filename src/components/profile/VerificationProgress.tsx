import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Lock, TrendingUp } from "lucide-react";
import { type StatusTier, getAllTiers } from "@/lib/statusEngine";
import { VerificationBadge } from "./VerificationBadge";

interface VerificationProgressProps {
  level: number;
  xp: number;
  portfolioCount: number;
  creditsCount: number;
  awardsCount: number;
  pressCount: number;
  socialVerified: boolean;
  verificationScore?: number; // Optional: show database score
  onRequestVerification?: () => void;
}

export function VerificationProgress({
  level,
  xp,
  portfolioCount,
  creditsCount,
  awardsCount,
  pressCount,
  socialVerified,
  verificationScore,
  onRequestVerification,
}: VerificationProgressProps) {
  const allTiers = getAllTiers();
  const currentTierIdx = Math.min(level, allTiers.length - 1);
  const currentTierData = allTiers[currentTierIdx] || allTiers[0];
  const progress = Math.min(100, (portfolioCount + creditsCount + awardsCount) * 5);

  // Calculate smart weighted score
  const portfolioPoints = Math.min(40, 
    portfolioCount >= 10 ? 40 : 
    portfolioCount >= 7 ? 35 : 
    portfolioCount >= 4 ? 28 : 
    portfolioCount >= 2 ? 15 : 0
  );
  
  const creditsPoints = Math.min(25, creditsCount * 3);
  
  const socialPoints = 
    !socialVerified ? 0 :
    (pressCount > 0 || awardsCount > 0) ? 20 : // Bonus if verified elsewhere
    portfolioCount >= 3 ? 15 : 8;
  
  const awardsPoints = 
    awardsCount === 0 ? 0 :
    awardsCount >= 2 ? 10 : 7;
  
  const pressPoints = pressCount > 0 ? 5 : 0;
  
  const totalScore = verificationScore ?? (portfolioPoints + creditsPoints + socialPoints + awardsPoints + pressPoints);
  
  const requirements = [
    { 
      label: "Portfolio Projects", 
      current: portfolioCount, 
      needed: 2, 
      met: portfolioCount >= 2,
      points: portfolioPoints,
      description: portfolioCount >= 10 ? "Extensive (40pts)" : 
                  portfolioCount >= 7 ? "Experienced (35pts)" :
                  portfolioCount >= 4 ? "Solid (28pts)" :
                  portfolioCount >= 2 ? "Minimum (15pts)" : "None"
    },
    { 
      label: "Credits & Experience", 
      current: creditsCount, 
      needed: 0, 
      met: true,
      points: creditsPoints,
      description: `Professional boost (+${creditsPoints}pts)`
    },
    { 
      label: "Social Links", 
      current: socialVerified ? 1 : 0, 
      needed: 1, 
      met: socialVerified,
      points: socialPoints,
      description: socialVerified ? `Connected (+${socialPoints}pts)` : "Required"
    },
    { 
      label: "Awards & Recognition", 
      current: awardsCount, 
      needed: 0, 
      met: true,
      points: awardsPoints,
      description: awardsPoints > 0 ? `Prestige (+${awardsPoints}pts)` : "Optional bonus"
    },
    { 
      label: "Press Features", 
      current: pressCount, 
      needed: 0, 
      met: true,
      points: pressPoints,
      description: pressPoints > 0 ? `Credibility (+${pressPoints}pts)` : "Optional bonus"
    },
  ];

  const coreRequirementsMet = portfolioCount >= 2 && socialVerified;
  const canRequestVerification = coreRequirementsMet;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Your Verification Status</h3>
          <p className="text-sm text-muted-foreground">
            Complete your profile to level up your badge
          </p>
        </div>
        <VerificationBadge level={level} xp={xp} />
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verification Score</span>
            <span className="font-bold text-lg">{totalScore}/100</span>
          </div>
          <Progress value={totalScore} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {totalScore >= 60 ? "Auto-approved at 60+" : 
             totalScore >= 40 ? "⏳ Manual review 40-59" : 
             "Need 40+ points"}
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verification Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Build your reputation with verified work
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Scoring Breakdown</h4>
          <Badge variant={totalScore >= 60 ? "default" : totalScore >= 40 ? "secondary" : "outline"}>
            {totalScore} Points
          </Badge>
        </div>
        
        <div className="space-y-2">
          {requirements.map((req, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card/50"
            >
              {req.met ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{req.label}</p>
                  <span className="text-xs font-semibold text-primary">+{req.points}pts</span>
                </div>
                <p className="text-xs text-muted-foreground">{req.description}</p>
              </div>
              {!req.met && req.needed > 0 && (
                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {canRequestVerification && onRequestVerification && (
        <Button 
          onClick={onRequestVerification}
          className="w-full gap-2"
          size="lg"
        >
          <TrendingUp className="w-4 h-4" />
          Request Verification ({totalScore}/100 points)
        </Button>
      )}

      {!canRequestVerification && (
        <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
          <p className="text-sm text-muted-foreground text-center">
            {!socialVerified && "Connect at least 1 social link to unlock verification"}
            {socialVerified && portfolioCount < 2 && `Add ${2 - portfolioCount} more portfolio item${portfolioCount === 1 ? '' : 's'} to unlock verification`}
          </p>
        </div>
      )}
    </Card>
  );
}
