import { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingTooltipProps {
  id: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  step?: number;
  totalSteps?: number;
}

const STORAGE_KEY = "thrivein_onboarding_dismissed";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismiss(id: string) {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  }
}

export const OnboardingTooltip = ({
  id,
  title,
  description,
  position = "bottom",
  children,
  step,
  totalSteps,
}: OnboardingTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissed = getDismissed();
    if (dismissed.includes(id)) return;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // Check if tour is already completed — don't show tooltips to returning users
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("tour_completed")
          .eq("user_id", user.id)
          .single();

        if (cancelled) return;

        // If tour already completed, auto-dismiss all tooltips permanently
        if (profile?.tour_completed) {
          dismiss(id);
          return;
        }
      } catch {
        return;
      }

      if (cancelled) return;
      const delay = 800 + (step ? (step - 1) * 5000 : 0);
      timerId = setTimeout(() => {
        const existing = document.querySelector('[data-onboarding-tooltip="true"]');
        if (!existing) {
          setVisible(true);
        }
      }, delay);
    })();

    return () => { cancelled = true; if (timerId) clearTimeout(timerId); };
  }, [id, step]);

  // Position the tooltip so it stays on screen
  const positionTooltip = useCallback(() => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 12;
    const viewportWidth = window.innerWidth;

    // Center horizontally relative to wrapper
    let left = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2;

    // Clamp to viewport
    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - padding - tooltipRect.width;
    }

    const style: React.CSSProperties = {
      position: "fixed",
      left: `${left}px`,
      zIndex: 9999,
    };

    if (position === "top") {
      style.bottom = `${window.innerHeight - wrapperRect.top + 8}px`;
    } else {
      style.top = `${wrapperRect.bottom + 8}px`;
    }

    setTooltipStyle(style);
  }, [position]);

  useEffect(() => {
    if (visible) {
      // Small delay to let the tooltip render before measuring
      requestAnimationFrame(positionTooltip);
    }
  }, [visible, positionTooltip]);

  const handleDismiss = () => {
    setVisible(false);
    dismiss(id);
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          data-onboarding-tooltip="true"
          className="w-56 sm:w-64 rounded-lg bg-primary text-primary-foreground p-3 shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-semibold text-sm">{title}</span>
            </div>
            <button onClick={handleDismiss} className="opacity-70 hover:opacity-100 -mt-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs opacity-90 leading-relaxed">{description}</p>
          {step && totalSteps && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] opacity-70">{step}/{totalSteps}</span>
              <Button
                size="sm"
                variant="secondary"
                className="h-6 text-xs px-2"
                onClick={handleDismiss}
              >
                Got it
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const resetOnboarding = () => {
  localStorage.removeItem(STORAGE_KEY);
};
