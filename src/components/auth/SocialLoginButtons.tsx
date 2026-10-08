import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

interface SocialLoginButtonsProps {
  onGoogleSignIn: () => void;
  googleLoading: boolean;
}

export const SocialLoginButtons = ({ onGoogleSignIn, googleLoading }: SocialLoginButtonsProps) => (
  <Button type="button" variant="outline" className="w-full h-11 gap-2" onClick={onGoogleSignIn} disabled={googleLoading}>
    {googleLoading ? <KretopiaSpinner className="h-4 w-4" /> : <Chrome className="h-4 w-4" />}
    Google
  </Button>
);

export const OrDivider = ({ text = "or continue with" }: { text?: string }) => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">{text}</span>
    </div>
  </div>
);
