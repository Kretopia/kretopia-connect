import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface EventRecapButtonProps {
  eventId: string;
  eventTitle: string;
  eventCategory: string;
  venueName?: string;
}

export const EventRecapButton = ({ eventId, eventTitle, eventCategory, venueName }: EventRecapButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);

  const createRecap = async () => {
    if (!user) return;
    setPosting(true);

    try {
      // Check if recap already posted
      const { data: existing } = await supabase
        .from('feed_posts')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_type', 'event_recap')
        .eq('source_id', eventId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Already posted", description: "A recap for this event has already been shared" });
        setPosting(false);
        return;
      }

      // Get attendee count
      const { count } = await supabase
        .from('jam_participants')
        .select('*', { count: 'exact', head: true })
        .eq('jam_id', eventId)
        .in('status', ['going', 'interested']);

      const content = `Just wrapped up "${eventTitle}"${venueName ? ` at ${venueName}` : ''}! ${count ? `${count} amazing creators joined.` : ''} What an incredible experience connecting with fellow creatives. 🙌\n\n#Kretopia #CreatorEvent #${eventCategory}`;

      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        content,
        post_type: 'update',
        source_type: 'event_recap',
        source_id: eventId,
        category: eventCategory,
        tags: ['event', 'recap', eventCategory],
      });

      if (error) throw error;

      toast({
        title: "Recap posted!",
        description: "Your event recap is now on the feed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create recap",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Button variant="gradient" className="w-full gap-2" onClick={createRecap} disabled={posting}>
      {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      Post Event Recap to Feed
    </Button>
  );
};
