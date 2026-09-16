import { useNavigate } from "react-router-dom";
import { Crown, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
  isPro: boolean;
}

export function ProGate({ feature, description, children, isPro }: ProGateProps) {
  const navigate = useNavigate();

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[300px]">
      {/* Blurred preview of the content */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-50 saturate-50">
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-card/95 backdrop-blur-md border border-primary/20 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-primary/10">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">Unlock {feature}</h3>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            {description || `Upgrade to Pro to access ${feature} and supercharge your creative workflow.`}
          </p>
          <Button
            onClick={() => navigate("/subscription")}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">$12/month · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

interface UsageLimitBannerProps {
  current: number;
  limit: number;
  itemName: string;
  isPro: boolean;
}

export function UsageLimitBanner({ current, limit, itemName, isPro }: UsageLimitBannerProps) {
  const navigate = useNavigate();

  if (isPro || current < limit) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-4">
      <Lock className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm text-foreground flex-1">
        You've reached the free limit of <strong>{limit} {itemName}</strong>. Upgrade to Pro for unlimited.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate("/subscription")}
        className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
      >
        <Crown className="h-3.5 w-3.5" />
        Upgrade
      </Button>
    </div>
  );
}
