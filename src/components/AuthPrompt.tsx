import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuthPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string;
}

/**
 * Modal prompt shown when a guest tries to perform an auth-required action.
 */
export function AuthPrompt({ open, onOpenChange, action = "do this" }: AuthPromptProps) {
  const navigate = useNavigate();

  const handleSignup = () => {
    // Store the pending action so we can resume after auth
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem("thrivein_post_auth_redirect", currentUrl);
    if (action.includes("claim")) {
      // Store claim intent for auto-attach after signup
      const params = new URLSearchParams(window.location.search);
      const projectName = params.get("name");
      if (projectName) {
        sessionStorage.setItem("thrivein_pending_claim", JSON.stringify({
          project_name: projectName,
          action,
        }));
      }
    }
    onOpenChange(false);
    navigate("/auth");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-2">
            <UserPlus className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle>Sign up to {action}</DialogTitle>
          <DialogDescription>
            Create a free account — credit claiming is always free. Build your verified professional record.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={handleSignup}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Sign Up Free
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignup}
            className="text-muted-foreground"
          >
            Already have an account? Sign In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage the auth prompt state.
 * Returns a guard function that either runs the callback (if authed) or shows the prompt.
 */
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useAuthPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("do this");

  const requireAuth = useCallback((actionLabel: string, callback?: () => void) => {
    if (user) {
      callback?.();
      return true;
    }
    setAction(actionLabel);
    setOpen(true);
    return false;
  }, [user]);

  return { open, setOpen, action, requireAuth, AuthPromptDialog: () => <AuthPrompt open={open} onOpenChange={setOpen} action={action} /> };
}
