import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, RefreshCw } from "lucide-react";
import { NetworkVisualization } from "./NetworkVisualization";
import { InviteDialog } from "@/components/InviteDialog";

interface EmptyMatchStateProps {
  onRefresh: () => void;
}

export const EmptyMatchState = ({ onRefresh }: EmptyMatchStateProps) => {
  const navigate = useNavigate();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="text-center py-6">
      {/* Network Visualization with Invite CTA */}
      <NetworkVisualization onInvite={() => setShowInvite(true)} />

      {/* Separator */}
      <div className="flex items-center gap-4 my-8 px-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Secondary Actions */}
      <div className="space-y-3 px-4">
        <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 inline-flex" aria-hidden="true">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h4 className="font-semibold text-lg" id="empty-state-heading">All Caught Up!</h4>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          You've swiped through all available creators. New creators join daily!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button onClick={onRefresh} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Feed
          </Button>
          <Button onClick={() => navigate('/messages')} size="sm" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Check Messages
          </Button>
        </div>
      </div>

      {/* Invite Dialog */}
      <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
    </div>
  );
};