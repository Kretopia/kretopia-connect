import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Sparkles, Rocket, Send, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-dom-confetti';
import { useState, useEffect, useMemo } from 'react';
import { StartProjectFromMatchDialog } from '@/components/project/StartProjectFromMatchDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedProfile: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
  currentUserAvatar?: string | null;
  matchId?: string;
}

const confettiConfig = {
  angle: 90,
  spread: 120,
  startVelocity: 45,
  elementCount: 100,
  dragFriction: 0.12,
  duration: 3000,
  stagger: 3,
  width: '10px',
  height: '10px',
  colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'],
};

/**
 * Icebreakers are role-aware so they feel personal, not templated.
 * Tapping one SENDS the message immediately and routes to the chat —
 * removing the friction that produced 2 matches → 0 conversations.
 */
const buildIcebreakers = (role?: string, name?: string): string[] => {
  const first = name?.split(' ')[0] || 'there';
  const lower = (role || '').toLowerCase();
  if (lower.includes('photo')) {
    return [
      `Hey ${first}! Your photography is stunning — would love to collaborate on a shoot.`,
      `${first}, do you take on creative briefs? I have a project in mind.`,
      `Big fan of your work. What kind of projects are you taking on next?`,
    ];
  }
  if (lower.includes('music') || lower.includes('produce') || lower.includes('artist')) {
    return [
      `Hey ${first}! Loving your sound — open to collabs?`,
      `${first}, what's your current project? Would love to hear more.`,
      `Your work caught my eye. Want to jam on something?`,
    ];
  }
  if (lower.includes('design') || lower.includes('art')) {
    return [
      `Hey ${first}! Your style is incredible. Open to creative projects?`,
      `${first}, I'd love to commission something — got time to chat?`,
      `Big fan of your aesthetic. What are you working on right now?`,
    ];
  }
  if (lower.includes('video') || lower.includes('film') || lower.includes('director')) {
    return [
      `Hey ${first}! Your reels are fire — would love to work together.`,
      `${first}, I have a project that needs your eye. Got 5 mins?`,
      `Loved your latest work. Are you booking new clients?`,
    ];
  }
  return [
    `Hey ${first}! Big fan of your work — want to collaborate on something?`,
    `${first}, your profile caught my eye. What are you working on?`,
    `Love what you do. Open to a quick chat about a potential project?`,
  ];
};

export function MatchModal({
  open,
  onOpenChange,
  matchedProfile,
  currentUserAvatar,
  matchId,
}: MatchModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [sendingIdx, setSendingIdx] = useState<number | null>(null);
  const [sentIdx, setSentIdx] = useState<number | null>(null);

  const icebreakers = useMemo(
    () => buildIcebreakers(matchedProfile?.role, matchedProfile?.full_name),
    [matchedProfile?.role, matchedProfile?.full_name],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => setShowConfetti(true), 100);
      setSentIdx(null);
      setSendingIdx(null);
    } else {
      setShowConfetti(false);
    }
  }, [open]);

  if (!matchedProfile) return null;

  const matchedInitials = matchedProfile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?';

  const sendIcebreaker = async (text: string, idx: number) => {
    if (!user || !matchedProfile) return;
    setSendingIdx(idx);
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: matchedProfile.user_id,
        content: text,
        read: false,
      });
      if (error) throw error;

      // Track conversion — this is the key metric we're trying to lift
      const { trackEvent, EventCategory } = await import('@/lib/analytics');
      trackEvent({
        eventName: 'match_icebreaker_sent',
        eventCategory: EventCategory.ENGAGEMENT,
        properties: {
          match_id: matchId,
          recipient_id: matchedProfile.user_id,
          icebreaker_index: idx,
        },
      });

      // Fire push + email notification
      (async () => {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        if (senderProfile) {
          const { notifyMessage } = await import('@/lib/pushNotifications');
          notifyMessage(matchedProfile.user_id, senderProfile.full_name || 'Someone', text).catch(() => {});
          supabase.functions
            .invoke('send-user-email', {
              body: { type: 'message', recipientId: matchedProfile.user_id, data: { messagePreview: text } },
            })
            .catch(() => {});
        }
      })();

      setSentIdx(idx);
      setSendingIdx(null);
      // Auto-route to the conversation so they can keep talking
      setTimeout(() => {
        onOpenChange(false);
        navigate(`/messages?user=${matchedProfile.user_id}`);
      }, 700);
    } catch (err: any) {
      setSendingIdx(null);
      toast({
        title: "Couldn't send",
        description: err?.message || 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChat = () => {
    onOpenChange(false);
    navigate(`/messages?user=${matchedProfile.user_id}&from=match`);
  };

  const handleStartProject = () => {
    onOpenChange(false);
    setShowProjectDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background border-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
            <Confetti active={showConfetti} config={confettiConfig} />
          </div>

          <div className="p-6 sm:p-8 text-center">
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-3">
                <Sparkles className="h-5 w-5" />
                <span className="font-semibold">It's a Match!</span>
              </div>
              <h2 className="text-2xl font-bold">
                You matched with {matchedProfile.full_name?.split(' ')[0]}!
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Tap an icebreaker to start the conversation now
              </p>
            </div>

            {/* Avatars */}
            <div className="relative flex justify-center items-center mb-6">
              <Avatar className="h-20 w-20 border-4 border-background shadow-xl z-10 -mr-4">
                {currentUserAvatar ? (
                  <AvatarImage src={currentUserAvatar} alt="You" />
                ) : (
                  <AvatarFallback className="text-xl bg-primary text-primary-foreground">You</AvatarFallback>
                )}
              </Avatar>
              <div className="absolute z-20 bg-destructive rounded-full p-1.5 shadow-lg">
                <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <Avatar className="h-20 w-20 border-4 border-background shadow-xl z-10 -ml-4">
                <AvatarImage src={matchedProfile.avatar_url || ''} alt={matchedProfile.full_name} />
                <AvatarFallback className="text-xl bg-secondary">{matchedInitials}</AvatarFallback>
              </Avatar>
            </div>

            {/* Tap-to-send icebreakers */}
            <div className="space-y-2 mb-5 text-left">
              {icebreakers.map((text, idx) => {
                const isSending = sendingIdx === idx;
                const isSent = sentIdx === idx;
                const disabled = sendingIdx !== null || sentIdx !== null;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendIcebreaker(text, idx)}
                    disabled={disabled}
                    className={cn(
                      'group w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      'hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isSent && 'border-primary bg-primary/10',
                    )}
                  >
                    <div
                      className={cn(
                        'shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                        isSent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground',
                      )}
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSent ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </div>
                    <p className="text-sm flex-1 leading-snug">{text}</p>
                  </button>
                );
              })}
            </div>

            {/* Secondary actions */}
            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2" size="lg" onClick={handleOpenChat}>
                <MessageCircle className="h-4 w-4" />
                Write your own message
              </Button>
              <Button
                variant="ghost"
                className="w-full gap-2 text-primary hover:bg-primary/5"
                size="sm"
                onClick={handleStartProject}
              >
                <Rocket className="h-4 w-4" />
                Or start a project together
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => onOpenChange(false)}>
                Continue browsing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StartProjectFromMatchDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        matchedUser={{
          id: matchedProfile.user_id,
          name: matchedProfile.full_name,
          role: matchedProfile.role,
          avatar: matchedProfile.avatar_url,
        }}
        matchId={matchId}
      />
    </>
  );
}
