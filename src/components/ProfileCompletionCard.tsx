import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, User, Briefcase, MapPin, Image, Award, Link as LinkIcon, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProfileCompletionStatus } from "@/lib/profileCompletion";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useTranslation } from "react-i18next";

interface ProfileCompletionCardProps {
  completion: ProfileCompletionStatus;
}

const fieldIcons: Record<string, any> = {
  'Full Name': User,
  'Role/Title': Briefcase,
  'Bio': Sparkles,
  'Profile Picture': Image,
  'Location': MapPin,
  'Skills (3+)': Award,
  'Portfolio Items': Image,
  'Website or Social Link': LinkIcon,
};

const fieldActions: Record<string, { section?: string; tab?: string }> = {
  'Full Name': { section: 'basic' },
  'Role/Title': { section: 'basic' },
  'Bio': { section: 'bio' },
  'Profile Picture': { section: 'avatar' },
  'Location': { section: 'basic' },
  'Skills (3+)': { section: 'skills' },
  'Portfolio Items': { section: 'portfolio' },
  'Website or Social Link': { section: 'social' },
};

export const ProfileCompletionCard = ({ completion }: ProfileCompletionCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const { isComplete: onboardingDone } = useOnboarding();
  const { t } = useTranslation();

  if (completion.percentage === 100) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{t("profile.complete")}</h3>
            <p className="text-sm text-muted-foreground">{t("profile.completeDesc")}</p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">100%</Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{t("profile.completeYourProfile")}</h3>
            {completion.percentage >= 75 && (
              <Badge variant="secondary" className="text-xs">{t("profile.almostThere")}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">{completion.percentage}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8"
              aria-label={expanded ? "Collapse profile completion details" : "Expand profile completion details"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <Progress value={completion.percentage} className="h-3" />
        
        {expanded && (
          <>
            {completion.missingFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t("profile.boostVisibility")}
                </p>
                {completion.missingFields.map((field) => {
                  const Icon = fieldIcons[field] || Circle;
                    return (
                      <button 
                        key={field}
                        onClick={() => navigate('/profile', { state: { section: fieldActions[field]?.section } })}
                        className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="h-4 w-4 text-muted-foreground" />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{field}</span>
                        </div>
                        <span className="text-xs text-primary font-medium">{t("profile.add")}</span>
                      </button>
                    );
                })}
              </div>
            )}

            {completion.completedFields.length > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  ✓ {t("profile.completed")} ({completion.completedFields.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {completion.completedFields.map((field) => {
                    const Icon = fieldIcons[field] || CheckCircle2;
                    return (
                      <div key={field} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        <Icon className="h-3 w-3" />
                        <span>{field}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <Button 
          onClick={() => navigate(onboardingDone ? '/profile' : '/onboarding')} 
          className="w-full"
          variant="default"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {t("profile.completeProfile")} (+50 XP)
        </Button>
      </div>
    </Card>
  );
};
