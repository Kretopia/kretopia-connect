import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, MapPin, Briefcase, Heart, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchExplanationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    user_id?: string;
    name: string;
    title: string;
    location: string;
    image: string;
    /** Why this person was suggested, from real fields and signals (see lib/matchReasons.ts). */
    matchReasons?: string[];
    match_reasons?: string[];
    /** @deprecated Ignored. A ranking weight is not a percentage and is no longer shown. */
    matchScore?: number;
    /** @deprecated Ignored, as above. */
    ai_match_score?: number;
  };
  onConnect: () => void;
  onPass: () => void;
}

/**
 * "Why you match": the concrete reasons this person was suggested, and nothing else. It used to show a
 * percentage with a "Perfect Match" label (defaulting to 85% when no score was passed in) and, when the AI
 * call failed, generic reasons such as "great collaboration potential" that no data supported. A score
 * that is not a measure of anything, and reasons that are not true of these two people, are not shown.
 */
export const MatchExplanationDialog = ({ open, onOpenChange, match, onConnect, onPass }: MatchExplanationDialogProps) => {
  const reasons = match.matchReasons ?? match.match_reasons ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Why you match
          </DialogTitle>
          <DialogDescription>What you and {match.name} have in common on Kretopia</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-14 w-14">
              <AvatarImage src={match.image} alt={match.name} />
              <AvatarFallback>{match.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{match.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                <Briefcase className="h-3 w-3" />
                {match.title}
              </p>
              {match.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {match.location}
                </p>
              )}
            </div>
          </div>

          {/* Reasons */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Why they were suggested
            </h4>
            {reasons.length > 0 ? (
              <ul className="space-y-2">
                {reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-primary/5 border border-primary/10">
                    <Heart className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground p-2 rounded-lg bg-muted/40">
                No shared craft, skills, city or history yet. Open their Passport to see their work and decide for yourself.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onPass();
                onOpenChange(false);
              }}
            >
              Pass
            </Button>
            <Button
              className="flex-1 bg-green-500 hover:bg-green-600"
              onClick={() => {
                onConnect();
                onOpenChange(false);
              }}
            >
              <Heart className="h-4 w-4 mr-2 fill-current" />
              Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
