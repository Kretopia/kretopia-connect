import { CallBrand, CallMediaControls } from "@/components/calls/CallMediaControls";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Maximize2, ScreenShare, Circle, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { AdmitQueue } from "@/components/calls/AdmitQueue";
import { cn } from "@/lib/utils";
import { liveRecordingCopy } from "@/lib/recordingState";
import { RecordingReminder } from "@/components/calls/RecordingReminder";

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
    recordingPhase, recordingReminder, recordingSegment, stopRecording, saveRecording,
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
  const recordingCopy = liveRecordingCopy(recordingPhase);

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/meet/${meetingId}`);
    toast({ title: "Invite link copied" });
  };
  const handleToggleRecord = () => toggleRecord().catch((e) => toast({ title: "Recording unavailable", description: e?.message, variant: "destructive" }));
  const handleToggleShare = () => toggleShare().catch((e) => toast({ title: "Couldn't share", description: e?.message, variant: "destructive" }));

  return (
    <div
      className={cn(
        "k-call-surface z-[60]",
        !live
          ? "hidden"
          : docked
            ? "fixed inset-0 flex flex-col bg-background text-foreground"
            : "k-call-floating fixed flex flex-col rounded-lg overflow-hidden shadow-2xl ring-1 ring-border bg-background",
      )}
    >
      {/* Docked-only header */}
      <div className={cn("k-call-header flex shrink-0 items-center justify-between border-b", !docked && "hidden")}>
        <CallBrand />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            {recordingCopy ? (
              <>
                <Circle className="h-2 w-2 fill-destructive text-destructive" />
                <span role="status" className="text-foreground font-medium">{recordingCopy.label}</span>
              </>
            ) : (
              "Live"
            )}
          </p>
        </div>
        <Button variant="ghost"
          type="button"
          onClick={leave}
          className="k-call-icon rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary"
          aria-label="Leave call"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Middle slot -- the persistent container lives here, in the same
          tree position whether docked or floating. */}
      <div className="k-call-video relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {docked && <AdmitQueue call={callRef.current} isHost={isHost} />}
        {docked && <RecordingReminder visible={recordingReminder} segment={recordingSegment} onStop={stopRecording} onSave={saveRecording} />}
        {!docked && recordingReminder && <div className="fixed bottom-[calc(306px+env(safe-area-inset-bottom,0px))] right-3 w-80 max-w-[calc(100vw-2rem)]"><RecordingReminder visible segment={recordingSegment} onStop={stopRecording} onSave={saveRecording} /></div>}

        {/* Floating-only mini controls, overlaid on the video itself. */}
        <div className={cn("absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none", docked && "hidden")}>
          <div className="flex items-center justify-end pointer-events-auto">
            <Button variant="ghost"
              type="button"
              onClick={() => navigate(`/meet/${meetingId}`)}
              aria-label="Expand call"
              className="k-call-icon rounded-lg flex items-center justify-center bg-muted/50 text-foreground hover:bg-background/90"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1.5 pointer-events-auto">
            <Button variant="ghost"
              type="button"
              onClick={() => void toggleMic()}
              aria-label={micOn ? "Mute" : "Unmute"}
              className="k-call-icon rounded-lg flex items-center justify-center bg-secondary text-foreground hover:bg-accent"
            >
              {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost"
              type="button"
              onClick={() => void leave()}
              aria-label="Leave call"
              className="k-call-icon rounded-lg flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Docked-only bottom control bar */}
      <div
        className={cn("k-call-footer", !docked && "hidden")}
      >
        <CallMediaControls call={callRef.current} />
        <div className="k-call-controls">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={sharing ? "Stop screen sharing" : "Share screen"}
            onClick={handleToggleShare}
            className={cn(
              "rounded-full gap-2 h-10 px-4 border border-border",
              sharing ? "bg-primary text-primary-foreground border-transparent" : "bg-secondary text-foreground hover:bg-secondary",
            )}
          >
            <ScreenShare className="h-4 w-4" />
            {sharing ? "Stop" : "Share"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={recording ? "Stop recording" : "Start recording"}
            onClick={handleToggleRecord}
            disabled={["requested", "stopping", "processing"].includes(recordingPhase)}
            className={cn(
              "rounded-full gap-2 h-10 px-4 border border-border",
              recording ? "bg-destructive text-destructive-foreground border-transparent" : "bg-secondary text-foreground hover:bg-secondary",
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
            className="rounded-full gap-2 h-10 px-4 border border-border bg-secondary text-foreground hover:bg-secondary"
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
