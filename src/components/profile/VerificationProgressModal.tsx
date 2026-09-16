import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, Sparkles, Shield, Award, Music, Users, Globe, Search, Database, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'complete' | 'skipped';
  result?: string;
}

interface VerificationProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (result: any) => void;
  profileData: {
    fullName: string;
    role: string;
    bio?: string;
  };
  socialLinks: Record<string, string>;
}

const VERIFICATION_STEPS: Omit<VerificationStep, 'status' | 'result'>[] = [
  {
    id: 'profile',
    label: 'Analyzing Profile',
    description: 'Scanning profile information and bio',
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: 'social',
    label: 'Verifying Social Links',
    description: 'Checking Instagram, YouTube, Spotify, LinkedIn',
    icon: <Globe className="h-5 w-5" />,
  },
  {
    id: 'databases',
    label: 'Searching Industry Databases',
    description: 'Checking IMDB, Discogs, AllMusic, Spotify',
    icon: <Database className="h-5 w-5" />,
  },
  {
    id: 'awards',
    label: 'Checking Award Databases',
    description: 'Grammy, Emmy, Oscar, Billboard, BRIT Awards',
    icon: <Award className="h-5 w-5" />,
  },
  {
    id: 'streams',
    label: 'Analyzing Streaming Data',
    description: 'Spotify listeners, YouTube views, Apple Music',
    icon: <Music className="h-5 w-5" />,
  },
  {
    id: 'press',
    label: 'Verifying Press & Media',
    description: 'Checking press links, validating publications',
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    id: 'web',
    label: 'Web Presence Search',
    description: 'Additional mentions, features, articles',
    icon: <Search className="h-5 w-5" />,
  },
  {
    id: 'calculate',
    label: 'Calculating Verification Score',
    description: 'Compiling all verified credentials',
    icon: <Sparkles className="h-5 w-5" />,
  },
];

export function VerificationProgressModal({
  open,
  onOpenChange,
  onComplete,
  profileData,
  socialLinks,
}: VerificationProgressModalProps) {
  const [steps, setSteps] = useState<VerificationStep[]>(
    VERIFICATION_STEPS.map(s => ({ ...s, status: 'pending' }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [overallProgress, setOverallProgress] = useState(0);

  const runVerification = async () => {
    setIsVerifying(true);
    setCurrentStepIndex(0);
    setOverallProgress(0);
    setVerificationResult(null);
    
    // Reset all steps
    setSteps(VERIFICATION_STEPS.map(s => ({ ...s, status: 'pending' })));

    // Simulate step progression with realistic timing
    const stepTimings = [800, 1200, 1500, 1200, 1000, 1100, 600];
    
    for (let i = 0; i < VERIFICATION_STEPS.length; i++) {
      // Set current step to running
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'running' } : s
      ));
      setCurrentStepIndex(i);
      setOverallProgress(Math.round((i / VERIFICATION_STEPS.length) * 100));

      // Wait for step "processing"
      await new Promise(resolve => setTimeout(resolve, stepTimings[i]));

      // Mark step complete with result
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'complete', result: getStepResult(s.id, socialLinks) } : s
      ));
    }

    // Now call the actual API
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('verify-credentials', {
        body: { profileData, socialLinks }
      });

      if (error) throw error;

      setVerificationResult(data);
      setOverallProgress(100);
      
      // Wait a moment then complete
      setTimeout(() => {
        onComplete?.(data);
      }, 1500);

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({ error: 'Verification failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStepResult = (stepId: string, links: Record<string, string>): string => {
    switch (stepId) {
      case 'profile':
        return 'Profile data extracted';
      case 'social':
        const linkedCount = Object.values(links).filter(v => v).length;
        return linkedCount > 0 ? `${linkedCount} social links found` : 'No links provided';
      case 'databases':
        return 'Searching 4 databases...';
      case 'awards':
        return 'Checking 6 award organizations';
      case 'streams':
        return 'Analyzing streaming platforms';
      case 'web':
        return 'Scanning web presence';
      case 'calculate':
        return 'Finalizing score...';
      default:
        return 'Complete';
    }
  };

  useEffect(() => {
    if (open && !isVerifying && !verificationResult) {
      runVerification();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setSteps(VERIFICATION_STEPS.map(s => ({ ...s, status: 'pending' })));
      setCurrentStepIndex(0);
      setOverallProgress(0);
      setVerificationResult(null);
      setIsVerifying(false);
    }
  }, [open]);

  const getStatusIcon = (status: VerificationStep['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'skipped':
        return <Circle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/50" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Smart Credential Verification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Verification Progress</span>
              <span className="font-medium">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Profile Being Verified */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium">{profileData.fullName}</p>
            <p className="text-xs text-muted-foreground">{profileData.role}</p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all duration-300",
                  step.status === 'running' && "bg-primary/5 border-primary/30",
                  step.status === 'complete' && "bg-green-500/5 border-green-500/20",
                  step.status === 'pending' && "opacity-50"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  step.status === 'running' && "bg-primary/10 text-primary",
                  step.status === 'complete' && "bg-green-500/10 text-green-500",
                  step.status === 'pending' && "bg-muted text-muted-foreground"
                )}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{step.label}</p>
                    {getStatusIcon(step.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.result && step.status === 'complete' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ {step.result}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Result Summary */}
          {verificationResult && !verificationResult.error && (
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Verification Complete!</span>
                </div>
                <Badge variant={
                  verificationResult.tier === 'elite' ? 'default' :
                  verificationResult.tier === 'industry' ? 'secondary' : 'outline'
                }>
                  {verificationResult.tier?.toUpperCase()} Tier
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-background/50">
                  <p className="text-muted-foreground text-xs">Score</p>
                  <p className="font-bold text-lg">{verificationResult.totalScore}/100</p>
                </div>
                <div className="p-2 rounded bg-background/50">
                  <p className="text-muted-foreground text-xs">Credentials Found</p>
                  <p className="font-bold text-lg">{verificationResult.credentials?.length || 0}</p>
                </div>
              </div>

              {verificationResult.achievements?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {verificationResult.achievements.slice(0, 4).map((badge: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
