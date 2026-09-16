import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

/**
 * Overlay shown on protected pages when the user is not authenticated.
 * Renders children blurred behind a sign-up CTA.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred content preview */}
      <div
        className="pointer-events-none select-none filter blur-md opacity-60"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* CTA overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-30">
        <div className="bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-primary/10 max-w-sm mx-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold mb-1">Sign up to unlock</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Create a free account to access this feature, build your credits, and start collaborating.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => navigate("/auth")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold"
            >
              Sign Up Free
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/auth")}
              className="text-muted-foreground"
            >
              Already have an account? Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
