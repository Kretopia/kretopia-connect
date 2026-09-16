import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * IMDb-style floating banner for unauthenticated users.
 * Shows at the bottom of the screen, above the bottom nav area.
 */
export function GuestBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (user || dismissed) return null;

  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-30 px-3 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-md lg:px-0 pointer-events-none hidden sm:block">
      <div className="pointer-events-auto bg-card/95 border-t lg:border border-primary/20 lg:rounded-2xl px-4 py-3 lg:py-4 shadow-2xl shadow-primary/10">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Claim your credits, land real gigs</p>
            <p className="text-[11px] text-muted-foreground">Free to start · Creator from $29/mo</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/auth")}
            className="shrink-0 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
}
