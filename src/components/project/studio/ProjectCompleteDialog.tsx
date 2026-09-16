import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ProjectCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
}

/**
 * Shown once, the moment the six-phase rail reaches "Complete" via an
 * explicit step validation — purely informative, not a confirmation.
 * The actual close-out action (mark the project row complete, notify
 * collaborators) stays WrapProjectCard's job; this dialog doesn't touch
 * the database.
 */
export function ProjectCompleteDialog({ open, onOpenChange, projectTitle }: ProjectCompleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center sm:max-w-sm">
        <div className="mx-auto h-14 w-14 rounded-full bg-[hsl(var(--energy)/0.15)] ring-1 ring-[hsl(var(--energy)/0.4)] flex items-center justify-center mb-1">
          <PartyPopper className="h-7 w-7" style={{ color: "hsl(var(--energy))" }} />
        </div>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Every phase complete</DialogTitle>
          <DialogDescription className="text-center">
            "{projectTitle}" made it through Discuss, Define, Build, Review, Commit and
            Complete. Wrap the project below to close it out and add it to your credits.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
