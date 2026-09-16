import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, CheckCircle2, AlertCircle, Crown, 
  Star, Verified, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AchievementBadges } from "./AchievementBadges";
import { VerificationProgressModal } from "./VerificationProgressModal";
import { VerificationReportCard } from "./VerificationReportCard";

export interface CredentialVerificationCardProps {
  userId: string;
  fullName?: string;
  role?: string;
  bio?: string;
  socialLinks?: Record<string, string>;
  currentTier?: 'verified' | 'industry' | 'elite' | string;
  currentAchievements?: string[];
  verifiedCredentials?: any[];
  verificationScore?: number;
  verifiedAt?: string;
  breakdown?: {
    awards: number;
    credits: number;
    social: number;
    streams: number;
  };
  onVerificationComplete?: (result?: any) => void;
}

export function CredentialVerificationCard({
  userId,
  fullName = '',
  role = '',
  bio = '',
  socialLinks = {},
  currentTier,
  currentAchievements = [],
  verifiedCredentials = [],
  verificationScore,
  verifiedAt,
  breakdown,
  onVerificationComplete
}: CredentialVerificationCardProps) {
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const { toast } = useToast();

  const handleVerificationComplete = (data: any) => {
    setVerificationResult(data);
    onVerificationComplete?.(data);
    
    // Close modal after a delay
    setTimeout(() => {
      setShowProgressModal(false);
      
      if (data.tier === 'elite') {
        toast({
          title: "Elite Verified!",
          description: `Congratulations! You've been verified as Elite with ${data.achievements?.length || 0} achievements.`,
        });
      } else if (data.tier === 'industry') {
        toast({
          title: "Industry Verified!",
          description: `Your industry credentials have been verified.`,
        });
      } else {
        toast({
          title: "✓ Profile Verified",
          description: "Your profile has been verified successfully.",
        });
      }
    }, 2000);
  };

  const displayTier = verificationResult?.tier || currentTier;
  const displayAchievements = verificationResult?.achievements || currentAchievements;
  const displayCredentials = verificationResult?.credentials || verifiedCredentials;
  const displayScore = verificationResult?.totalScore || verificationScore;
  const displayBreakdown = verificationResult?.breakdown || breakdown;

  // If already verified, show the report card
  if (displayTier && displayScore) {
    return (
      <>
        <VerificationReportCard
          verificationTier={displayTier}
          verificationScore={displayScore}
          verifiedCredentials={displayCredentials}
          achievementBadges={displayAchievements}
          verifiedAt={verifiedAt}
          breakdown={displayBreakdown}
          isOwnProfile={true}
          onReVerify={() => setShowProgressModal(true)}
        />
        
        <VerificationProgressModal
          open={showProgressModal}
          onOpenChange={setShowProgressModal}
          onComplete={handleVerificationComplete}
          profileData={{ fullName, role, bio }}
          socialLinks={socialLinks}
        />
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Smart Credential Verification
            </CardTitle>
            <CardDescription>
              Thrive verifies your credentials across industry databases
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Achievements */}
          {displayAchievements.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Achievements</p>
              <AchievementBadges 
                achievements={displayAchievements} 
                showAll
              />
            </div>
          )}

          {/* Verification Info */}
          <div className="p-4 rounded-lg border border-dashed bg-muted/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Get Verified by AI</p>
                <p className="text-muted-foreground mt-1">
                  Watch as Thrive scans IMDB, Grammy, Spotify, and 7 other databases to verify your professional credentials in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Verification Tiers Explanation */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Verified className="w-4 h-4 mx-auto text-primary mb-1" />
              <div className="font-medium text-primary">Verified</div>
              <div className="text-muted-foreground">Profile complete</div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Star className="w-4 h-4 mx-auto text-primary mb-1" />
              <div className="font-medium text-primary">Industry</div>
              <div className="text-muted-foreground">IMDB/Credits</div>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Crown className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
              <div className="font-medium text-yellow-500">Elite</div>
              <div className="text-muted-foreground">Major Awards</div>
            </div>
          </div>

          {/* Verify Button */}
          <Button 
            onClick={() => setShowProgressModal(true)}
            className="w-full gap-2"
          >
            <Shield className="w-4 h-4" />
            Start AI Verification
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll see exactly what our AI checks in real-time
          </p>
        </CardContent>
      </Card>

      <VerificationProgressModal
        open={showProgressModal}
        onOpenChange={setShowProgressModal}
        onComplete={handleVerificationComplete}
        profileData={{ fullName, role, bio }}
        socialLinks={socialLinks}
      />
    </>
  );
}
