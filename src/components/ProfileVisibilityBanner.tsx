import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Camera, FileText, Image } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";

interface ProfileVisibilityBannerProps {
  isVisible: boolean;
  missingFields: string[];
}

const fieldIcons: Record<string, React.ReactNode> = {
  'Profile Picture': <Camera className="h-4 w-4" />,
  'Bio (20+ characters)': <FileText className="h-4 w-4" />,
  'At least 1 Portfolio Item': <Image className="h-4 w-4" />,
};

export const ProfileVisibilityBanner = ({ isVisible, missingFields }: ProfileVisibilityBannerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isComplete: onboardingDone } = useOnboarding();
  const isOnProfilePage = location.pathname === '/profile';

  if (isVisible) {
    return null; // Profile is complete and visible
  }

  return (
    <Alert className="mb-4 border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 animate-in slide-in-from-top shadow-md">
      <EyeOff className="h-5 w-5 text-orange-500" />
      <AlertTitle className="text-orange-900 dark:text-orange-100 font-bold flex items-center gap-2">
        You're Hidden from Discovery
      </AlertTitle>
      <AlertDescription className="text-orange-800 dark:text-orange-200 space-y-3">
        <p className="text-sm">
          Other creators can't find you until you complete your profile. <strong>Quality over quantity.</strong>
        </p>
        
        <div className="flex flex-wrap gap-2">
          {missingFields.map((field) => (
            <div 
              key={field} 
              className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/40 px-2.5 py-1.5 rounded-full text-xs font-medium"
            >
              {fieldIcons[field] || <Eye className="h-3.5 w-3.5" />}
              <span>{field}</span>
            </div>
          ))}
        </div>

        {!isOnProfilePage && (
          <Button
            size="sm"
            className="gap-2 w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => navigate(onboardingDone ? '/profile' : '/onboarding')}
          >
            <Eye className="h-4 w-4" />
            Complete Profile
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};
