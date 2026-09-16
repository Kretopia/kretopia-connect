import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSavedOpportunity } from "@/hooks/useSavedOpportunity";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface BookmarkButtonProps {
  opportunityId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "lg" | "icon";
  showText?: boolean;
  className?: string;
}

export const BookmarkButton = ({ 
  opportunityId, 
  variant = "ghost", 
  size = "icon",
  showText = false,
  className = ""
}: BookmarkButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSaved, loading, toggleSave } = useSavedOpportunity(opportunityId, user?.id);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!user) {
      navigate(`/auth?redirect=/opportunity/${opportunityId}`);
      return;
    }

    await toggleSave();
    
    // Track opportunity save/unsave
    const { trackEvent } = await import("@/lib/analytics");
    await trackEvent({
      eventName: isSaved ? 'opportunity_unsaved' : 'opportunity_saved',
      eventCategory: 'opportunities',
      properties: { opportunity_id: opportunityId }
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={className}
      title={isSaved ? "Remove bookmark" : "Save opportunity"}
    >
      {isSaved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">
          {isSaved ? "Saved" : "Save"}
        </span>
      )}
    </Button>
  );
};
