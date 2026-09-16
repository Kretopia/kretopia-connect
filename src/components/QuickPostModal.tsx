import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";

type PostType = "gig" | "event";

interface QuickPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PostType;
}

/**
 * Unified entry point for "Post a Gig" / "Post an Event".
 * Gigs delegate to the canonical PostOpportunityDialog (rich flow with
 * Barter/Paid/Collab, AI write, brand/creator nudges, etc.) so all
 * gig-creation surfaces stay in sync.
 */
export function QuickPostModal({ open, onOpenChange, type }: QuickPostModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isGig = type === "gig";

  // Gigs → use the canonical rich dialog.
  if (isGig) {
    return (
      <PostOpportunityDialog
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setEventDate("");
  };

  const publishEvent = async (userId: string, formData: any) => {
    const startTime = formData.eventDate || new Date(Date.now() + 7 * 86400000).toISOString();
    const { data, error } = await supabase.from("creative_jams").insert({
      title: formData.title,
      description: formData.description || null,
      venue_name: formData.location || null,
      start_time: startTime,
      created_by: userId,
      category: "general",
      ends_at: new Date(new Date(startTime).getTime() + 3 * 3600000).toISOString(),
    }).select("id").single();

    if (error) throw error;
    return data.id;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const formData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      eventDate: eventDate.trim(),
      type,
    };

    if (!user) {
      sessionStorage.setItem("thrivein_pending_post", JSON.stringify(formData));
      toast.info("Sign up to publish your post — we've saved your details!");
      onOpenChange(false);
      navigate(`/auth?redirect=/dashboard`);
      return;
    }

    setSubmitting(true);
    try {
      const id = await publishEvent(user.id, formData);
      toast.success("Event posted! Add more details to get RSVPs.");
      onOpenChange(false);
      navigate(`/event/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to post");
    } finally {
      setSubmitting(false);
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Post an Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <Input
            placeholder="e.g. Creative Meetup — Downtown"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
            autoFocus
          />

          <Textarea
            placeholder="What's the event about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] resize-none"
          />

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-11 pl-9"
            />
          </div>

          <Input
            type="datetime-local"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="h-11"
          />

          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="w-full h-11 font-semibold"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !user ? (
              `Continue & Sign Up to Publish`
            ) : (
              `Publish Event`
            )}
          </Button>

          {!user && (
            <p className="text-[10px] text-muted-foreground text-center">
              Your details are saved — just create an account to go live
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
