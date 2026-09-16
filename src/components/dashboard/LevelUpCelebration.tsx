import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LevelUpCelebrationProps {
  newLevel: number;
  xp: number;
  previousLevel: number;
  open: boolean;
  onClose: () => void;
}

export function LevelUpCelebration({ newLevel, xp, previousLevel, open, onClose }: LevelUpCelebrationProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center border-0 bg-gradient-to-b from-background to-muted/50">
        <div className="py-6 space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-bounce">
              <Sparkles className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1">Status Upgraded!</h2>
            <p className="text-muted-foreground">
              Your reputation is growing. Keep building verified work.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => { onClose(); navigate("/profile"); }} variant="default">
              View Profile
            </Button>
            <Button onClick={onClose} variant="ghost" className="gap-2">
              Keep Going <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
