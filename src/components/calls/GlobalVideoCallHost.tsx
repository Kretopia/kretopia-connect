import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Maximize2, ScreenShare, Circle, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { AdmitQueue } from "@/components/calls/AdmitQueue";
import { cn } from "@/lib/utils";

/**
 * Renders exactly ONE persistent DOM node for the Daily iframe
 * (VideoCallContext.containerRef) for the lifetime of a call, mounted once
 * at the app shell level (see App.tsx) so route navigation never unmounts
 * it. Only its CSS position/size change between "docked" (full-screen, on
 * the matching /meet/:meetingId route) and "floating" (a small fixed corner
 * box everywhere else) -- the header/footer chrome around it are ordinary
 * siblings that mount/unmount freely, since they don't hold the iframe.
 *
 * The persistent container's own JSX position in the tree never changes
 * (always the same wrapper -> same middle slot), only classNames/inline
 * styles on already-mounted elements -- conditionally swapping which
 * *ancestor* wraps it would make React remount the node and kill the
 * Daily iframe, which is the exact bug this whole feature exists to fix.
 */
export function GlobalVideoCallHost() {
  const {
    meetingId,
    phase,
    containerRef,
    callRef,
    isHost,
    title,
    recording,
    sharing,
    micOn,
    leave,
    toggleRecord,
    toggleShare,
    toggleMic,
  } = useVideoCall();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!meetingId) return null;

  const docked = location.pathname === `/meet/${meetingId}`;
  const live = phase === "live";

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/meet/${meetingId}`);
    toast({ title: "Invite link copied" });
  };
  const handleToggleRecord = () => toggleRecord().catch((e) => toast({ title: "Recording unavailable", description: e?.message, variant: "destructive" }));
  const handleToggleShare = () => toggleShare().catch((e) => toast({ title: "Couldn't share", description: e?.message, variant: "destructive" }));

  return (
    <div
      className={cn(
        "z-[60]",
        !live
          ? "hidden"
          : docked
            ? "fixed inset-0 flex flex-col bg-[#0b0b0f] text-white"
            : "fixed bottom-20 right-4 sm:bottom-4 flex flex-col rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#0b0b0f]",
      )}
      style={docked ? undefined : { width: 224, height: 168 }}
    >
      {/* Docked-only header */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b border-white/5", !docked && "hidden")}>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-white/50 flex items-center gap-1.5">
            {recording ? (
              <>
                <Circle className="h-2 w-2 fill-destructive text-destructive" />
                <span className="text-destructive font-medium">Recording</span>
              </>
            ) : (
              "Live"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={leave}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Middle slot -- the persistent container lives here, in the same
          tree position whether docked or floating. */}
      <div className="relative flex-1 min-h-0 bg-black">
        <div ref={containerRef} className="absolute inset-0" />
        {docked && <AdmitQueue call={callRef.current} isHost={isHost} />}

        {/* Floating-only mini controls, overlaid on the video itself. */}
        <div className={cn("absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none", docked && "hidden")}>
          <div className="flex items-center justify-end pointer-events-auto">
            <button
              type="button"
              onClick={() => navigate(`/meet/${meetingId}`)}
              aria-label="Expand call"
              className="h-6 w-6 rounded-md flex items-center justify-center bg-black/50 text-white hover:bg-black/70"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => void toggleMic()}
              aria-label={micOn ? "Mute" : "Unmute"}
              className="h-7 w-7 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20"
            >
              {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              aria-label="Leave call"
              className="h-7 w-7 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Docked-only bottom control bar */}
      <div
        className={cn("px-3 pt-3 border-t border-white/5", !docked && "hidden")}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleShare}
            className={cn(
              "rounded-full gap-2 h-10 px-4 border border-white/10",
              sharing ? "bg-primary text-primary-foreground border-transparent" : "bg-white/5 text-white hover:bg-white/10",
            )}
          >
            <ScreenShare className="h-4 w-4" />
            {sharing ? "Stop" : "Share"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void toggleMic()}
            className={cn(
              "rounded-full gap-2 h-10 px-4 border border-white/10",
              !micOn ? "bg-white/5 text-white hover:bg-white/10" : "bg-primary text-primary-foreground border-transparent",
            )}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            {micOn ? "Mute" : "Unmute"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleRecord}
            className={cn(
              "rounded-full gap-2 h-10 px-4 border border-white/10",
              recording ? "bg-destructive text-destructive-foreground border-transparent" : "bg-white/5 text-white hover:bg-white/10",
            )}
          >
            <Circle className={cn("h-3 w-3", recording && "fill-current")} />
            {recording ? "Stop" : "Record"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyLink}
            className="rounded-full gap-2 h-10 px-4 border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
            Invite
          </Button>
          <Button
            type="button"
            onClick={() => void leave()}
            className="rounded-full gap-2 h-11 px-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="font-semibold">Leave</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GlobalVideoCallHost;
