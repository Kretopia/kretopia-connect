import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface Props {
  eventId: string;
  eventTitle: string;
  isCreator: boolean;
  circleId?: string | null;
  category?: string;
  coverImageUrl?: string;
  onLinked?: () => void;
}

/**
 * Past-event "Continue in a Circle" bridge.
 * - If host & no circle yet → create a Circle, link event, add all attendees as members.
 * - If circle already exists → "Open Circle" for everyone.
 */
export const ContinueAsCircle = ({
  eventId,
  eventTitle,
  isCreator,
  circleId,
  category,
  coverImageUrl,
  onLinked,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [resolvedCircleId, setResolvedCircleId] = useState<string | null>(circleId || null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    setResolvedCircleId(circleId || null);
  }, [circleId]);

  // Check membership when circle exists
  useEffect(() => {
    if (!resolvedCircleId || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("spark_room_members")
        .select("id")
        .eq("room_id", resolvedCircleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setIsMember(!!data);
    })();
    return () => { cancelled = true; };
  }, [resolvedCircleId, user]);

  const handleCreateCircle = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data: roomId, error: rpcErr } = await supabase.rpc("create_circle_from_event", {
        _event_id: eventId,
        _title: eventTitle,
        _description: `Group chat continued from the event "${eventTitle}".`,
        _category: category || "general",
        _cover_image_url: coverImageUrl || null,
      });
      if (rpcErr || !roomId) throw rpcErr || new Error("Failed to create Circle");

      setResolvedCircleId(roomId as string);
      setIsMember(true);
      toast({
        title: "🎉 Circle created",
        description: "Attendees have been added. Tap Open to start chatting.",
      });
      onLinked?.();
    } catch (err: any) {
      toast({
        title: "Couldn't create Circle",
        description: err?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinAndOpen = async () => {
    if (!user || !resolvedCircleId) return;
    if (!isMember) {
      const { error } = await supabase.from("spark_room_members").insert({
        room_id: resolvedCircleId,
        user_id: user.id,
        role: "member",
      });
      if (error && !error.message.includes("duplicate")) {
        toast({ title: "Couldn't join", description: error.message, variant: "destructive" });
        return;
      }
    }
    navigate(`/circle/${resolvedCircleId}`);
  };

  // Already exists: show "Open Circle"
  if (resolvedCircleId) {
    return (
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Continue the conversation</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          A Circle exists for this event — keep chatting with the people you met.
        </p>
        <Button size="sm" variant="gradient" className="w-full gap-1.5" onClick={handleJoinAndOpen}>
          Open Circle <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  // No circle yet — only host can spin it up
  if (!isCreator) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          The host hasn't started a Circle for this event yet. Check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Keep this group going</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Spin up a private Circle and bring everyone who attended into one chat — no WhatsApp group needed.
      </p>
      <Button
        size="sm"
        variant="gradient"
        className="w-full gap-1.5"
        onClick={handleCreateCircle}
        disabled={creating}
      >
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {creating ? "Creating Circle…" : "Continue in a Circle"}
      </Button>
    </div>
  );
};
