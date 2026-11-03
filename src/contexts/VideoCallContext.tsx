import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { VideoCallSheetProps } from "@/components/project/VideoCallSheet";

/**
 * VideoCallContext: who owns the one call.
 *
 * Every call in the app is the same call: a Studio call, a Messages call, a meeting opened from `/meet/:id`, a guest link opened from
 * `/call/:token`. A caller hands its room to `openStudioCall` (usually through `<VideoCallSheet>`), and GlobalVideoCallHost, mounted once
 * at the app shell, renders PersistentStudioCall for it: one Daily frame, one lobby, one toolbar. Navigating away only resizes that frame
 * (full page, miniature), it never rejoins. `/meet` and `/call` used to carry a call of their own (their own frame, header and controls);
 * they now only fetch the room's access and start this one.
 *
 * Only one call can be live at a time (Daily allows one frame), so a second one is refused and the person is told.
 */

/** The one call, with the caller (sheet facade) that owns it. */
export type StudioCallEntry = VideoCallSheetProps & { owner?: string };

export const CALL_BUSY_TITLE = "You're already in a call";
export const CALL_BUSY_DESCRIPTION = "Leave it before starting another.";

const sameConfig = (a: StudioCallEntry, b: StudioCallEntry) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof StudioCallEntry>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

interface VideoCallContextValue {
  studioCall: StudioCallEntry | null;
  /** Starts the call for `owner`. False (and the user is told) when another call is already live. */
  openStudioCall: (props: VideoCallSheetProps, owner?: string) => boolean;
  /** Keeps the live call's configuration (overlay, flags, callbacks) in step with its owner. No-op for anyone else. */
  updateStudioCall: (props: VideoCallSheetProps, owner?: string) => void;
  /** Ends the call. With `owner`, only if that caller started it. */
  closeStudioCall: (owner?: string) => void;
}

const VideoCallContext = createContext<VideoCallContextValue | undefined>(undefined);

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const [studioCall, setStudioCallState] = useState<StudioCallEntry | null>(null);
  // Read by callbacks that must keep one identity for the life of the call (changing it re-runs the call's effect).
  const studioRef = useRef<StudioCallEntry | null>(null);
  const setStudioCall = useCallback((next: StudioCallEntry | null) => { studioRef.current = next; setStudioCallState(next); }, []);

  const openStudioCall = useCallback((props: VideoCallSheetProps, owner?: string) => {
    const current = studioRef.current;
    if (current && current.owner !== owner) {
      // The page that started this call was left and has been opened again: the same room is the same call,
      // so it takes over (no second frame, no message). Any other room is a second call.
      if (current.roomUrl && current.roomUrl === props.roomUrl) { setStudioCall({ ...props, open: true, owner }); return true; }
      toast(CALL_BUSY_TITLE, { description: CALL_BUSY_DESCRIPTION });
      return false;
    }
    if (!current) setStudioCall({ ...props, open: true, owner });
    return true;
  }, [setStudioCall]);

  const updateStudioCall = useCallback((props: VideoCallSheetProps, owner?: string) => {
    const current = studioRef.current;
    if (!current || current.owner !== owner) return;
    const next = { ...props, open: true, owner };
    if (!sameConfig(current, next)) setStudioCall(next);
  }, [setStudioCall]);

  const closeStudioCall = useCallback((owner?: string) => {
    const current = studioRef.current;
    // Only a string scopes the close: this is also used directly as an onClick, which passes the event.
    if (!current || (typeof owner === "string" && current.owner !== owner)) return;
    setStudioCall(null);
  }, [setStudioCall]);

  const value: VideoCallContextValue = { studioCall, openStudioCall, updateStudioCall, closeStudioCall };
  return <VideoCallContext.Provider value={value}>{children}</VideoCallContext.Provider>;
}

export function useVideoCall(): VideoCallContextValue {
  const ctx = useContext(VideoCallContext);
  if (!ctx) throw new Error("useVideoCall must be used within a VideoCallProvider");
  return ctx;
}
