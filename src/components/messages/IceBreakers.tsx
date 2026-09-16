import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IceBreakersProps {
  recipientId: string;
  recipientName: string;
  recipientRole?: string;
  currentUserRole?: string;
  onSelectIceBreaker: (message: string) => void;
}

const DEFAULT_ICE_BREAKERS = [
  "Hey! I noticed we matched - what kind of projects are you working on right now?",
  "Love your portfolio! Would be great to chat about a potential collaboration.",
  "Hi! What type of creative work are you most passionate about?",
  "Hey there! I'm always looking for talented creators to work with. What's your specialty?",
];

export const IceBreakers = ({
  recipientId,
  recipientName,
  recipientRole,
  currentUserRole,
  onSelectIceBreaker,
}: IceBreakersProps) => {
  const [iceBreakers, setIceBreakers] = useState<string[]>(DEFAULT_ICE_BREAKERS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateAIIceBreakers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ice-breakers', {
        body: {
          recipientId,
          recipientName,
          recipientRole: recipientRole || 'Creator',
          currentUserRole: currentUserRole || 'Creator',
        },
      });

      if (error) throw error;

      if (data?.iceBreakers && Array.isArray(data.iceBreakers)) {
        setIceBreakers(data.iceBreakers);
        setHasGenerated(true);
      }
    } catch (error) {
      console.error('Error generating ice breakers:', error);
      // Keep default ice breakers on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-generate on mount if we have profile info
    if (recipientRole && !hasGenerated) {
      generateAIIceBreakers();
    }
  }, [recipientRole]);

  return (
    <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Conversation Starters</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateAIIceBreakers}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </>
          )}
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {iceBreakers.slice(0, 4).map((iceBreaker, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-2 px-3 text-xs text-left whitespace-normal max-w-full hover:bg-primary/10 hover:border-primary/30"
            onClick={() => onSelectIceBreaker(iceBreaker)}
          >
            {iceBreaker.length > 60 ? `${iceBreaker.slice(0, 60)}...` : iceBreaker}
          </Button>
        ))}
      </div>
    </div>
  );
};
