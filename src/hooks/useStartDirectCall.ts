import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ringUsers } from "@/hooks/useIncomingCall";
import { prefetchDaily } from "@/lib/dailyFrame";

export interface DirectCallSession {
  roomUrl: string;
  roomName: string;
  token: string;
  callId: string | null;
}

interface StartOptions {
  /** Override toast title shown when the call fails to start. */
  errorTitle?: string;
  /** Optional context label (e.g. "vibe-check", "gig-interview") for analytics/logs. */
  context?: string;
}

/**
 * Shared logic for starting a 1:1 video call with another user.
 * Used by ChatHeader (Match Vibe Check), inline VibeCheckPrompt, and
 * the gig dashboard's Quick Interview button.
 */
export const useStartDirectCall = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);
  // Ref guard: `starting` state only flips on the next render, so a fast
  // double-click (or two handlers in the same tick) could otherwise fire two
  // create-call requests and spawn two rooms.
  const inFlightRef = useRef(false);
  const [session, setSession] = useState<DirectCallSession | null>(null);
  const [open, setOpen] = useState(false);

  const myName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Someone";

  const start = async (
    recipientId: string,
    recipientName: string,
    opts: StartOptions = {},
  ): Promise<DirectCallSession | null> => {
    if (!recipientId || inFlightRef.current || !user) return null;
    inFlightRef.current = true;
    setStarting(true);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-direct-video-call",
        { body: { invited_user_id: recipientId, user_name: myName } },
      );
      if (error) throw error;
      if (!data?.room_url || !data?.token) throw new Error("No room");
      // Warm the video SDK now that we know a room exists — no media access.
      prefetchDaily();

      const next: DirectCallSession = {
        roomUrl: data.room_url,
        roomName: data.room_name,
        token: data.token,
        callId: data.call_id ?? null,
      };
      setSession(next);
      setOpen(true);

      void ringUsers([recipientId], {
        kind: "direct",
        callerId: user.id,
        callerName: myName,
        callerAvatar: user.user_metadata?.avatar_url ?? null,
        roomUrl: next.roomUrl,
        roomName: next.roomName,
        callId: next.callId,
      }).catch((err) => console.error("[useStartDirectCall] ring failed", err));

      // After 30s with no pickup, mark the call as missed so it shows in
      // history and notifies the recipient. The DB function is a no-op if
      // the call has already ended (someone picked up).
      if (next.callId) {
        const callIdToMark = next.callId;
        setTimeout(() => {
          supabase.rpc("mark_direct_call_missed" as any, { _call_id: callIdToMark })
            .then(({ error }) => { if (error) console.warn("[mark missed]", error); });
        }, 30_000);
      }

      return next;
    } catch (e: any) {
      console.error(`[useStartDirectCall${opts.context ? `:${opts.context}` : ""}]`, e);
      toast({
        title: opts.errorTitle || "Couldn't start call",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      inFlightRef.current = false;
      setStarting(false);
      console.info(
        `[call] create finished in ${Math.round(performance.now() - t0)}ms`,
      );
    }
  };

  return {
    starting,
    session,
    open,
    setOpen,
    start,
    myName,
  };
};
