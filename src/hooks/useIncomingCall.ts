import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface IncomingCall {
  kind: "project" | "direct";
  projectId?: string;
  projectName?: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  roomUrl: string;
  /** For 1:1 calls only — the temporary daily room name; receiver mints their own meeting token. */
  roomName?: string;
  callId?: string | null;
  ringingSince: number;
}

/**
 * Listens on a per-user Realtime channel (`call-ring:{userId}`) for incoming
 * call broadcasts. The caller fans out a `ring` event to every recipient when
 * a call starts; this hook surfaces the latest one to the UI.
 *
 * Usage:
 *   const { incoming, dismiss } = useIncomingCallListener();
 *   {incoming && <IncomingCallModal call={incoming} onClose={dismiss} />}
 */
export function useIncomingCallListener() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`call-ring:${user.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        if (!payload) return;
        setIncoming({
          kind: payload.kind,
          projectId: payload.projectId,
          projectName: payload.projectName,
          callerId: payload.callerId,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar ?? null,
          roomUrl: payload.roomUrl,
          roomName: payload.roomName,
          callId: payload.callId ?? null,
          ringingSince: Date.now(),
        });
      })
      .on("broadcast", { event: "cancel" }, () => {
        setIncoming(null);
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
      channelRef.current = null;
    };
  }, [user?.id]);

  const dismiss = useCallback(() => setIncoming(null), []);
  return { incoming, dismiss };
}

/**
 * Sends a `ring` broadcast to one or many users. Returns immediately —
 * receivers' channels deliver the payload without any DB write.
 */
export async function ringUsers(userIds: string[], payload: Omit<IncomingCall, "ringingSince">) {
  await Promise.all(
    userIds.map(async (uid) => {
      const ch = supabase.channel(`call-ring:${uid}`);
      try {
        await ch.subscribe();
        await ch.send({ type: "broadcast", event: "ring", payload });
      } catch (e) {
        console.warn("[ringUsers] failed for", uid, e);
      } finally {
        try {
          supabase.removeChannel(ch);
        } catch {}
      }
    }),
  );
}
