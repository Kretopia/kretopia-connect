import { useCallback, useRef } from "react";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { PersistentStudioCall } from "@/components/project/VideoCallSheet";

/**
 * Renders the one call, mounted once at the app shell (see App.tsx) so that route navigation never unmounts it. Whatever started it (a
 * Studio or Messages page, a meeting opened from /meet, a guest link opened from /call) handed its room to VideoCallContext; this is
 * where that room becomes a call. The call's own window (PersistentCallWindow) decides whether it fills the page, is a miniature or is
 * minimized: only its CSS changes between those, so the Daily iframe is never destroyed or remounted by navigation.
 */
export function GlobalVideoCallHost() {
  const { studioCall, closeStudioCall } = useVideoCall();
  // One identity for the life of the call: PersistentStudioCall re-runs its call effect (leave + rejoin) when it changes.
  const studioCallRef = useRef(studioCall);
  studioCallRef.current = studioCall;
  const handleClose = useCallback((open: boolean) => {
    if (open) return;
    const entry = studioCallRef.current; // read before closing: closing clears it
    closeStudioCall();
    entry?.onOpenChange(false);
  }, [closeStudioCall]);

  return studioCall ? <PersistentStudioCall {...studioCall} onOpenChange={handleClose} /> : null;
}

export default GlobalVideoCallHost;
