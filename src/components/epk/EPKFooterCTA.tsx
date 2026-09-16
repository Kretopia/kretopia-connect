import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserCheck, Building2, Share2, ArrowRight } from "lucide-react";

interface EPKFooterCTAProps {
  isOwner: boolean;
  isUnclaimed: boolean;
  profileName: string;
  onClaimClick?: () => void;
  onShareClick?: () => void;
}

export const EPKFooterCTA = ({ isOwner, isUnclaimed, profileName, onClaimClick, onShareClick }: EPKFooterCTAProps) => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
      <div className="max-w-lg mx-auto space-y-3">
        {isOwner ? (
          /* Owner view - share CTA */
          <Button
            onClick={onShareClick}
            className="w-full h-12 text-base font-semibold"
            variant="gradient"
            size="lg"
          >
            <Share2 className="h-5 w-5 mr-2" />
            Share Your Creative Passport
          </Button>
        ) : isUnclaimed ? (
          <>
            <Button
              onClick={onClaimClick}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
              size="lg"
            >
              <UserCheck className="h-5 w-5 mr-2" />
              Claim Your Creative Passport
            </Button>
            <Button
              onClick={() => navigate('/auth')}
              variant="outline"
              className="w-full h-10 text-sm"
            >
              Not you? Sign Up to Connect
            </Button>
          </>
        ) : (
          /* Non-user visitor - dual CTA */
          <div className="space-y-2">
            <Button
              onClick={() => navigate('/auth?type=creator')}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              <UserCheck className="h-5 w-5 mr-2" />
              Join as a Creator
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              onClick={() => navigate('/auth?type=brand')}
              variant="outline"
              className="w-full h-10 text-sm"
            >
              <Building2 className="h-4 w-4 mr-2" />
              I'm a Brand — Find Creators Like {profileName.split(' ')[0]}
            </Button>
          </div>
        )}

        {/* Secondary Links */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            About Kretopia
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            onClick={() => navigate('/auth')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Log In
          </button>
        </div>

        {/* Branding */}
        <div className="text-center pt-1">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">Kretopia</span>
          </p>
        </div>
      </div>
    </div>
  );
};
