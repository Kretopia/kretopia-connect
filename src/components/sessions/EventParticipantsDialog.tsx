import { useCallback, useEffect, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publicPassportPath } from "@/lib/passport/passportNav";

export interface EventParticipant {
  key: string;
  /** The member's id when they have an account (and so a public Passport); null for a guest RSVP. */
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  /** The role the member shows on their public profile, or "Guest RSVP". */
  role: string | null;
}

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; participants: EventParticipant[] };

interface EventParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /**
   * Whether this viewer may see who is going: the host's visibility setting, applied by the page (the host, and people who have a place,
   * always may; everyone else unless the host chose "host only"). When false nothing is read and nothing is listed.
   */
  canSee: boolean;
  /** Where focus goes when the dialog closes: the control that opened it. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

/**
 * Reads only what a visitor may see: the participants' ids and the typed name of a guest RSVP, then the public-safe profile of each member
 * (name, picture, role). A member whose profile the public view does not return is left out, never shown as a blank row. No email, no
 * phone, no owner-only field is selected anywhere in this file.
 */
async function loadParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data: rows, error } = await supabase
    .from("jam_participants")
    .select("id, user_id, guest_name, joined_at")
    .eq("jam_id", eventId)
    .eq("status", "going");
  if (error) throw error;

  const going = [...(rows || [])].sort((a, b) => String(a.joined_at ?? "").localeCompare(String(b.joined_at ?? "")));
  const userIds = [...new Set(going.map((row) => row.user_id).filter((id): id is string => !!id))];
  let profiles = new Map<string, { full_name: string | null; avatar_url: string | null; role: string | null }>();
  if (userIds.length) {
    const { data, error: profileError } = await supabase
      .from("public_profiles_safe")
      .select("user_id, full_name, avatar_url, role")
      .in("user_id", userIds);
    if (profileError) throw profileError;
    profiles = new Map((data || []).flatMap((profile) => (profile.user_id ? [[profile.user_id, profile] as const] : [])));
  }

  const seen = new Set<string>();
  const participants: EventParticipant[] = [];
  for (const row of going) {
    if (row.user_id) {
      const profile = profiles.get(row.user_id);
      if (!profile || seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      participants.push({
        key: `user:${row.user_id}`,
        userId: row.user_id,
        name: profile.full_name?.trim() || "Event attendee",
        avatarUrl: profile.avatar_url,
        role: profile.role?.trim() || null,
      });
    } else {
      participants.push({
        key: `guest:${row.id}`,
        userId: null,
        name: row.guest_name?.trim() || "Guest",
        avatarUrl: null,
        role: "Guest RSVP",
      });
    }
  }
  return participants;
}

export function EventParticipantsDialog({ open, onOpenChange, eventId, canSee, returnFocusRef }: EventParticipantsDialogProps) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchList = useCallback(async (isCurrent: () => boolean) => {
    setLoad({ status: "loading" });
    try {
      const participants = await loadParticipants(eventId);
      if (isCurrent()) setLoad({ status: "ready", participants });
    } catch (error) {
      console.error("Could not load the guest list:", error);
      if (isCurrent()) setLoad({ status: "error" });
    }
  }, [eventId]);

  // Every opening reads the list again: what is shown is the server's current answer, not what an earlier opening left behind.
  useEffect(() => {
    if (!open || !canSee) return;
    let current = true;
    void fetchList(() => current);
    return () => { current = false; };
  }, [open, canSee, fetchList]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-modal="true"
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Who's going</DialogTitle>
          <DialogDescription>Open a Passport to see more about them.</DialogDescription>
        </DialogHeader>

        {!canSee ? (
          <p className="text-sm text-muted-foreground" role="status">The host keeps the guest list private until you save a place.</p>
        ) : load.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <KretopiaSpinner className="h-4 w-4" /> Loading who's going
          </div>
        ) : load.status === "error" ? (
          <div className="space-y-3 py-2" role="alert">
            <p className="text-sm text-destructive">The guest list couldn't be loaded.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchList(() => true)}>Try again</Button>
          </div>
        ) : load.participants.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground" role="status">No one to show yet.</p>
        ) : (
          <ul aria-label="Who's going" className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {load.participants.map((participant) => (
              <li key={participant.key}>
                {participant.userId ? (
                  <Link
                    to={publicPassportPath(participant.userId)}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <ParticipantIdentity participant={participant} />
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                      View Passport <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    <ParticipantIdentity participant={participant} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ParticipantIdentity({ participant }: { participant: EventParticipant }) {
  return (
    <>
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={participant.avatarUrl || undefined} alt="" />
        <AvatarFallback>{participant.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{participant.name}</span>
        {participant.role && <span className="block truncate text-xs text-muted-foreground">{participant.role}</span>}
      </span>
    </>
  );
}

export default EventParticipantsDialog;
