import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X, ArrowRight, ArrowLeft, Sparkles, User,
  Users, Briefcase, MessageCircle, CheckCircle2, Palette, Building2,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VibePicker } from "@/components/onboarding/VibePicker";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  action: string;
  tip?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "audience",
    title: "Who's using Kretopia?",
    description: "We'll tune the language and what shows up first. You can switch anytime in Settings.",
    icon: <Sparkles className="h-6 w-6" />,
    route: "/circle",
    position: "center",
    action: "Continue",
  },
  {
    id: "vibe",
    title: "Pick your vibe",
    description: "Choose how the app looks. You can switch anytime in Settings.",
    icon: <Palette className="h-6 w-6" />,
    route: "/circle",
    position: "center",
    action: "Continue",
  },
  {
    id: "welcome",
    title: "Welcome to Kretopia",
    description: "Your creative network awaits. Let's get you set up in under 2 minutes.",
    icon: <Sparkles className="h-6 w-6" />,
    route: "/circle",
    position: "center",
    action: "Let's Go",
  },
  {
    id: "profile",
    title: "Build Your Creative Profile",
    description: "Add your skills, bio, and portfolio to attract the right collaborators and opportunities.",
    icon: <User className="h-6 w-6" />,
    route: "/profile",
    targetSelector: "[data-tour='profile-tab']",
    position: "top",
    action: "Go to Profile",
    tip: "Pro tip: Profiles with photos get 14x more views!",
  },
  {
    id: "circle",
    title: "Match with Creators",
    description: "Swipe through creators and opportunities. Right to connect, left to pass. Mutual interest = Match!",
    icon: <Users className="h-6 w-6" />,
    route: "/circle",
    targetSelector: "[data-tour='circle-tab']",
    position: "top",
    action: "Start Matching",
    tip: "Complete your profile to get better match recommendations.",
  },
  {
    id: "projects",
    title: "Collaborate on Projects",
    description: "Manage projects, milestones, and deliverables with your collaborators.",
    icon: <Briefcase className="h-6 w-6" />,
    route: "/desk",
    targetSelector: "[data-tour='projects-tab']",
    position: "top",
    action: "View Projects",
    tip: "Start a project after matching to keep everything organized.",
  },
  {
    id: "messages",
    title: "Stay Connected",
    description: "Message your matches and collaborators. Build relationships that lead to great work.",
    icon: <MessageCircle className="h-6 w-6" />,
    route: "/messages",
    targetSelector: "[data-tour='messages-tab']",
    position: "top",
    action: "View Messages",
    tip: "Use ice breakers to start conversations easily.",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "Start connecting, collaborating, and creating amazing things together.",
    icon: <CheckCircle2 className="h-6 w-6" />,
    route: "/circle",
    position: "center",
    action: "Start Thriving",
  },
];

export function InteractiveOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [audience, setAudience] = useState<"creative" | "business" | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const chooseAudience = async (choice: "creative" | "business") => {
    setAudience(choice);
    if (!userId) return;
    setSavingAudience(true);
    try {
      await supabase
        .from("profiles")
        .update({ account_type: choice === "business" ? "company" : "individual" })
        .eq("user_id", userId);
    } catch (err) {
      console.error("[Tour] Failed to save audience choice:", err);
    } finally {
      setSavingAudience(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Update highlight position when step changes
  useEffect(() => {
    if (!isVisible) return;
    
    const step = ONBOARDING_STEPS[currentStep];
    if (step.targetSelector) {
      // Wait for DOM to update after navigation
      const timeout = setTimeout(() => {
        const element = document.querySelector(step.targetSelector!);
        if (element) {
          setHighlightRect(element.getBoundingClientRect());
        } else {
          setHighlightRect(null);
        }
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, isVisible, location.pathname]);

  const checkOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Check localStorage first as a fast fallback
      const localKey = `tour_completed_${user.id}`;
      if (localStorage.getItem(localKey) === "true") return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step, tour_completed")
        .eq("user_id", user.id)
        .single();

      // Only show interactive tour AFTER onboarding is completed and tour not yet done
      if (profile?.onboarding_completed && !profile?.tour_completed) {
        setCurrentStep(0);
        setIsVisible(true);
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }
  };

  const saveProgress = useCallback(async (_step: number, completed: boolean = false) => {
    if (!userId) return;
    
    if (completed) {
      await supabase
        .from("profiles")
        .update({ tour_completed: true })
        .eq("user_id", userId);
    }
  }, [userId]);

  const handleNext = async () => {
    const step = ONBOARDING_STEPS[currentStep];
    
    // Navigate to the step's route
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await saveProgress(nextStep);
    } else {
      await completeTour();
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      await saveProgress(prevStep);
      
      const step = ONBOARDING_STEPS[prevStep];
      if (step.route) {
        navigate(step.route);
      }
    }
  };

  const completeTour = async () => {
    setIsVisible(false);
    if (userId) {
      // Save to localStorage immediately to prevent re-showing on next page load
      localStorage.setItem(`tour_completed_${userId}`, "true");
      try {
        await supabase
          .from("profiles")
          .update({ tour_completed: true })
          .eq("user_id", userId);
        console.log("[Tour] Marked tour as completed for user", userId);
      } catch (err) {
        console.error("[Tour] Failed to save tour completion:", err);
      }
    }
    navigate("/circle");
  };

  const handleSkip = async () => {
    await completeTour();
  };

  if (!isVisible) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isCentered = step.position === "center" || !highlightRect;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Dark overlay */}
        <div 
          className="absolute inset-0 bg-background/90 backdrop-blur-sm transition-all duration-300"
          style={highlightRect ? {
            clipPath: `polygon(
              0% 0%, 
              0% 100%, 
              ${highlightRect.left - 8}px 100%, 
              ${highlightRect.left - 8}px ${highlightRect.top - 8}px, 
              ${highlightRect.right + 8}px ${highlightRect.top - 8}px, 
              ${highlightRect.right + 8}px ${highlightRect.bottom + 8}px, 
              ${highlightRect.left - 8}px ${highlightRect.bottom + 8}px, 
              ${highlightRect.left - 8}px 100%, 
              100% 100%, 
              100% 0%
            )`
          } : undefined}
        />
        
        {/* Highlight ring around target element */}
        {highlightRect && (
          <div 
            className="absolute border-2 border-primary rounded-lg animate-pulse pointer-events-none"
            style={{
              left: highlightRect.left - 8,
              top: highlightRect.top - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
            }}
          />
        )}
      </div>

      {/* Tooltip/Card */}
      <div 
        className={cn(
          "fixed z-[101] pointer-events-auto",
          isCentered 
            ? "inset-0 flex items-center justify-center p-4" 
            : "p-4"
        )}
        style={!isCentered && highlightRect ? getTooltipPosition(highlightRect, step.position) : undefined}
      >
        <Card className={cn(
          "w-full max-w-md border-primary/30 shadow-2xl bg-card",
          !isCentered && "shadow-primary/20"
        )}>
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div className="flex gap-1">
                  {ONBOARDING_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx === currentStep 
                          ? "bg-primary w-6" 
                          : idx < currentStep 
                            ? "bg-primary/60" 
                            : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-6">
              <h2 className="text-xl font-bold">{step.title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
              {step.id === "audience" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => chooseAudience("creative")}
                    disabled={savingAudience}
                    aria-pressed={audience === "creative"}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      audience === "creative"
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-foreground/[0.03]",
                    )}
                  >
                    <Palette className="h-5 w-5 text-primary mb-1.5" />
                    <p className="text-sm font-bold">Creative</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      I make work — film, music, design, photo, content.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseAudience("business")}
                    disabled={savingAudience}
                    aria-pressed={audience === "business"}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      audience === "business"
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-foreground/[0.03]",
                    )}
                  >
                    <Building2 className="h-5 w-5 text-primary mb-1.5" />
                    <p className="text-sm font-bold">Business / Brand</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      I hire creators, run a brand, agency, or production.
                    </p>
                  </button>
                </div>
              )}
              {step.id === "vibe" && (
                <div className="pt-1">
                  <VibePicker compact />
                </div>
              )}
              {step.tip && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-primary/80">{step.tip}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={isFirstStep}
                className="gap-2"
                size="sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="flex gap-2">
                {!isLastStep && !isFirstStep && (
                  <Button variant="ghost" onClick={handleSkip} size="sm">
                    Skip
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="gap-2"
                  size="sm"
                  disabled={step.id === "audience" && !audience}
                >
                  {step.action}
                  {!isLastStep && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

// Helper to position tooltip relative to highlighted element
function getTooltipPosition(rect: DOMRect, position?: string): React.CSSProperties {
  const padding = 16;
  const tooltipWidth = 400;
  
  switch (position) {
    case "bottom":
      return {
        left: Math.max(padding, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding)),
        top: rect.bottom + padding,
      };
    case "top":
      return {
        left: Math.max(padding, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding)),
        bottom: window.innerHeight - rect.top + padding,
      };
    case "left":
      return {
        right: window.innerWidth - rect.left + padding,
        top: rect.top,
      };
    case "right":
      return {
        left: rect.right + padding,
        top: rect.top,
      };
    default:
      return {};
  }
}
