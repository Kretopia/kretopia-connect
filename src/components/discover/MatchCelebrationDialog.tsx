import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, X, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface MatchCelebrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedUser: {
    name: string;
    avatar: string;
    role: string;
    userId?: string;
  };
  onSendMessage: () => void;
}

export const MatchCelebrationDialog = ({
  open,
  onOpenChange,
  matchedUser,
  onSendMessage,
}: MatchCelebrationDialogProps) => {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      // Stop confetti after 3 seconds
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        {/* Confetti effect */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              >
                <Sparkles
                  className="text-primary"
                  size={12 + Math.random() * 16}
                  style={{
                    opacity: 0.6 + Math.random() * 0.4,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="relative z-1 p-8 text-center space-y-6">
          {/* Match Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary to-primary/80 p-6 rounded-full">
                <Sparkles className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
          </div>

          {/* Match Text */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              It's a Match!             </h2>
            <p className="text-muted-foreground">
              You and <span className="font-semibold text-foreground">{matchedUser.name}</span> are now connected!
            </p>
          </div>

          {/* Matched User Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-md" />
              <img
                src={matchedUser.avatar}
                alt={matchedUser.name}
                className="relative w-32 h-32 rounded-full object-cover border-4 border-background shadow-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-semibold">{matchedUser.name}</h3>
            <p className="text-sm text-muted-foreground">{matchedUser.role}</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              className="w-full bg-gradient-to-r from-primary to-primary/80 shadow-glow"
              size="lg"
              onClick={() => {
                onOpenChange(false);
                navigate(`/messages?user=${matchedUser.userId}`);
              }}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Start a Conversation
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  if (matchedUser.userId) {
                    navigate(`/profile/${matchedUser.userId}`);
                  }
                }}
              >
                View Profile
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/desk', { state: { collaboratorId: matchedUser.userId, collaboratorName: matchedUser.name } });
                }}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Start Project
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
