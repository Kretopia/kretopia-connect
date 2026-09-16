import { Button } from "@/components/ui/button";
import { Loader2, Chrome } from "lucide-react";

interface SocialLoginButtonsProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  googleLoading: boolean;
  appleLoading: boolean;
}

export const SocialLoginButtons = ({ onGoogleSignIn, onAppleSignIn, googleLoading, appleLoading }: SocialLoginButtonsProps) => (
  <div className="grid grid-cols-2 gap-3">
    <Button type="button" variant="outline" className="h-11 gap-2" onClick={onGoogleSignIn} disabled={googleLoading}>
      {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
      Google
    </Button>
    <Button type="button" variant="outline" className="h-11 gap-2" onClick={onAppleSignIn} disabled={appleLoading}>
      {appleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
      )}
      Apple
    </Button>
  </div>
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
