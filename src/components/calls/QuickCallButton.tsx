import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { MeetingReadySheet } from "@/components/calls/MeetingReadySheet";
import { CallInviteSheet } from "@/components/project/CallInviteSheet";
import { APP_URL } from "@/lib/constants";

interface Props {
  /** Optional className for the trigger button. */
  className?: string;
  /** Render as compact icon-only button. */
  iconOnly?: boolean;
  /** Override label. */
  label?: string;
}

/**
 * Start a quick guest-friendly video call from anywhere — no chat thread or
 * project required. Creates a Daily room, generates a 4-hour guest link, opens
 * the call sheet, and shows the link so it can be copied/shared with anyone
 * (including non-users).
 */
export const QuickCallButton = ({
  className = "",
  iconOnly = false,
  label = "Start a call",
}: Props) => {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [guestLink, setGuestLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [session, setSession] = useState<{
    roomUrl: string;
    roomName: string;
    token: string;
    callId: string | null;
  } | null>(null);

  const myName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Host";

  const start = async () => {
    if (creating || !user) {
      if (!user) toast.error("Please sign in to start a call");
      return;
    }
    setCreating(true);
    try {
      // 1) Create the room (host-only — invited_user_id omitted).
      const { data, error } = await supabase.functions.invoke(
        "create-direct-video-call",
        { body: { user_name: myName } },
      );
      if (error) throw error;
      if (!data?.room_url || !data?.token) throw new Error("No room created");

      const next = {
        roomUrl: data.room_url as string,
        roomName: data.room_name as string,
        token: data.token as string,
        callId: (data.call_id as string) ?? null,
      };
      setSession(next);

      // 2) Mint a 4-hour guest link for non-users.
      const { data: linkData, error: linkErr } = await supabase.functions.invoke(
        "create-video-guest-link",
        {
          body: {
            room_name: next.roomName,
            room_url: next.roomUrl,
            direct_call_id: next.callId,
            guest_label: "Guest",
          },
        },
      );
      if (linkErr) throw linkErr;
      const url = `${APP_URL}/call/${linkData.token}`;
      setGuestLink(url);

      // 3) Show the "ready" sheet FIRST so host can copy/share before joining.
      //    The lobby only opens when they tap "Join now".
      setLinkOpen(true);
    } catch (e: any) {
      console.error("[QuickCallButton]", e);
      toast.error("Couldn't start the call", {
        description: e?.message || "Please try again.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    setLinkOpen(false);
    setCallOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        onClick={start}
        disabled={creating}
        className={className || (iconOnly
          ? "h-9 w-9 rounded-full p-0"
          : "rounded-full gap-2")}
        size={iconOnly ? "icon" : "sm"}
        aria-label="Start a quick call"
      >
        {creating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        {!iconOnly && <span className="text-sm font-medium">{label}</span>}
      </Button>

      {/* Step 1: ready sheet with link + copy + share + join */}
      <MeetingReadySheet
        open={linkOpen}
        onOpenChange={(o) => {
          setLinkOpen(o);
          // If they dismiss without joining or inviting, drop the session.
          if (!o && !callOpen && !contactsOpen) {
            setSession(null);
            setGuestLink(null);
          }
        }}
        shareUrl={guestLink}
        onJoin={handleJoin}
        onInviteContacts={() => setContactsOpen(true)}
        title="Your call is ready"
        joinLabel="Join now"
      />

      {/* Step 2: live call sheet */}
      <VideoCallSheet
        open={callOpen}
        onOpenChange={(o) => {
          setCallOpen(o);
          if (!o) {
            setSession(null);
            setGuestLink(null);
          }
        }}
        projectName="Quick call"
        roomUrl={session?.roomUrl ?? null}
        token={session?.token ?? null}
        callId={session?.callId ?? null}
        userName={myName}
        directCallId={session?.callId ?? null}
        roomName={session?.roomName ?? null}
        meetingShareUrl={guestLink}
        lobbyCta="Start call"
      />

      {/* Invite from contacts — available before joining */}
      {session && (
        <CallInviteSheet
          open={contactsOpen}
          onOpenChange={setContactsOpen}
          callContext={{
            kind: "direct",
            projectId: null,
            projectName: "Quick call",
            directCallId: session.callId,
            roomUrl: session.roomUrl,
            roomName: session.roomName,
            callId: session.callId,
            callerName: myName,
            callerAvatar: null,
            meetingShareUrl: guestLink,
          }}
        />
      )}
    </>
  );
};
