import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, UserCheck, ExternalLink, Sparkles } from "lucide-react";
import { useUnclaimedProfileMatch } from "@/hooks/useUnclaimedProfileMatch";
import { ClaimProfileDialog } from "./ClaimProfileDialog";
import { useQueryClient } from "@tanstack/react-query";

export const UnclaimedProfileSuggestion = () => {
  const { data: matches, isLoading } = useUnclaimedProfileMatch();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const queryClient = useQueryClient();

  // Filter out dismissed profiles
  const activeMatches = matches?.filter(m => !dismissed.includes(m.user_id)) || [];

  if (isLoading || activeMatches.length === 0) {
    return null;
  }

  const handleDismiss = (userId: string) => {
    setDismissed(prev => [...prev, userId]);
    // Store in localStorage to persist dismissals
    const stored = JSON.parse(localStorage.getItem('dismissed_profile_matches') || '[]');
    localStorage.setItem('dismissed_profile_matches', JSON.stringify([...stored, userId]));
  };

  const handleClaimSuccess = () => {
    setShowClaimDialog(false);
    setSelectedProfile(null);
    queryClient.invalidateQueries({ queryKey: ['unclaimed-profile-match'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  return (
    <>
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">Is this you?</span>
          </div>
          
          <p className="text-xs text-muted-foreground mb-4">
            We found profile(s) that might be yours. Claim to merge your professional history.
          </p>

          <div className="space-y-3">
            {activeMatches.map((match) => (
              <div 
                key={match.user_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={match.avatar_url || undefined} />
                  <AvatarFallback>
                    {match.full_name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{match.full_name}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {Math.round(match.similarity_score * 100)}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{match.role}</p>
                  {match.imported_from_url && (
                    <a 
                      href={match.imported_from_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      View source
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDismiss(match.user_id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    onClick={() => {
                      setSelectedProfile(match);
                      setShowClaimDialog(true);
                    }}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Claim
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProfile && (
        <ClaimProfileDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          profile={selectedProfile}
          onSuccess={handleClaimSuccess}
        />
      )}
    </>
  );
};
