import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Briefcase, Sparkles, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MatchActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  matchedUser: {
    user_id: string;
    full_name: string;
    avatar_url?: string;
    role?: string;
  };
  currentUserId: string;
}

const ICEBREAKERS = [
  "Hey! I love your work. Would love to chat about a potential collaboration!",
  "Hi! I think our skills could complement each other really well. Let's connect!",
  "Great to match with you! I have a project idea that might interest you.",
  "Hey! Saw your portfolio and I'm impressed. Let's explore working together!",
];

export const MatchActionSheet = ({ isOpen, onClose, matchedUser, currentUserId }: MatchActionSheetProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedIcebreaker, setSelectedIcebreaker] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!selectedIcebreaker) {
      // Just navigate to messages without pre-set message
      onClose();
      navigate(`/messages?user=${matchedUser.user_id}`);
      return;
    }

    setSending(true);
    try {
      // Send the icebreaker message
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUserId,
        receiver_id: matchedUser.user_id,
        content: selectedIcebreaker
      });

      if (error) throw error;

      toast({
        title: "Message sent!",
        description: `Your message was sent to ${matchedUser.full_name}`,
      });

      onClose();
      navigate(`/messages?user=${matchedUser.user_id}`);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleStartProject = () => {
    onClose();
    navigate('/desk', { state: { collaboratorId: matchedUser.user_id, collaboratorName: matchedUser.full_name } });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-primary/20">
                <AvatarImage src={matchedUser.avatar_url} alt={matchedUser.full_name} />
                <AvatarFallback className="text-2xl">
                  {matchedUser.full_name?.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                <Check className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <SheetTitle className="text-xl">
            You matched with {matchedUser.full_name}!           </SheetTitle>
          <SheetDescription>
            {matchedUser.role && (
              <Badge variant="secondary" className="mt-2">{matchedUser.role}</Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Quick Actions */}
          <div className="space-y-3">
            <Button 
              variant="default" 
              className="w-full h-auto py-4 flex items-center justify-center gap-2"
              onClick={handleSendMessage}
              disabled={sending}
            >
              <MessageCircle className="h-6 w-6" />
              <span>Start a Conversation</span>
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-auto py-3 flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5"
              onClick={handleStartProject}
            >
              <Briefcase className="h-5 w-5" />
              <span>Start Project Together</span>
            </Button>
          </div>

          {/* Icebreaker Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Quick icebreakers</span>
            </div>
            <div className="space-y-2">
              {ICEBREAKERS.map((icebreaker, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIcebreaker(
                    selectedIcebreaker === icebreaker ? null : icebreaker
                  )}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                    selectedIcebreaker === icebreaker 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  {icebreaker}
                </button>
              ))}
            </div>
          </div>

          {/* Send Selected Icebreaker */}
          {selectedIcebreaker && (
            <Button 
              className="w-full gap-2" 
              onClick={handleSendMessage}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send Icebreaker'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
