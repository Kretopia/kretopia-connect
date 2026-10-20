import { CallBrand, CallMediaControls } from "@/components/calls/CallMediaControls";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Maximize2, ScreenShare, Circle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { AdmitQueue } from "@/components/calls/AdmitQueue";
import { cn } from "@/lib/utils";
import { liveRecordingCopy } from "@/lib/recordingState";
import { RecordingReminder } from "@/components/calls/RecordingReminder";
import { useCallback, useRef, useState } from "react";
import { PersistentStudioCall } from "@/components/project/VideoCallSheet";
import { PersistentCallWindow, ConfirmCallLeave } from "./PersistentCallWindow";

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
    studioCall, closeStudioCall,
    startedAt, connectionStatus,
    phase,
    containerRef,
    callRef,
    isHost,
    title,
    recording,
    recordingPhase, recordingReminder, recordingSegment, stopRecording, saveRecording, dismissRecordingReminder, clearRecordingSegment,
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
  const [confirmLeave, setConfirmLeave] = useState(false);
  // One identity for the life of the call: PersistentStudioCall re-runs its call effect (leave + rejoin) when it changes.
  const studioCallRef = useRef(studioCall);
  studioCallRef.current = studioCall;
  const handleStudioClose = useCallback((open: boolean) => {
    if (open) return;
    const entry = studioCallRef.current; // read before closing: closing clears it
    closeStudioCall();
    entry?.onOpenChange(false);
  }, [closeStudioCall]);

  if (studioCall) return <PersistentStudioCall {...studioCall} onOpenChange={handleStudioClose} />;
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
    <><PersistentCallWindow route={`/meet/${meetingId}`} title={title} call={callRef.current} startedAt={startedAt} status={connectionStatus} recordingPhase={recordingPhase} active={live} onLeave={() => { void leave(); }}>
      {/* Docked-only header: the one call toolbar */}
      <div className={cn("k-call-header flex shrink-0 items-center justify-between border-b", !docked && "hidden")}>
        <div className="flex items-center gap-2 min-w-0">
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
        </div>
        <CallMediaControls call={callRef.current} toolbar>
          <Button
            type="button"
            variant="ghost"
            title={sharing ? "Stop screen sharing" : "Share screen"}
            aria-label={sharing ? "Stop screen sharing" : "Share screen"}
            aria-pressed={sharing}
            onClick={handleToggleShare}
            className={cn("k-call-icon rounded-lg", sharing ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-foreground hover:bg-accent")}
          >
            <ScreenShare className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            title={recording ? "Stop recording" : "Start recording"}
            aria-label={recording ? "Stop recording" : "Start recording"}
            aria-pressed={recording}
            onClick={handleToggleRecord}
            disabled={["requested", "stopping", "processing"].includes(recordingPhase)}
            className={cn("k-call-icon rounded-lg", recording ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-secondary text-foreground hover:bg-accent")}
          >
            <Circle className={cn("h-3.5 w-3.5", recording && "fill-current")} />
          </Button>
          <Button type="button" variant="ghost" title="Copy invite link" aria-label="Copy invite link" onClick={copyLink} className="k-call-icon rounded-lg bg-secondary text-foreground hover:bg-accent">
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="destructive" title="Leave call" aria-label="Leave call" onClick={() => setConfirmLeave(true)} className="k-call-icon rounded-lg">
            <PhoneOff className="h-4 w-4" />
          </Button>
        </CallMediaControls>
      </div>

      {/* Middle slot -- the persistent container lives here, in the same
          tree position whether docked or floating. */}
      <div className="k-call-video relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {docked && <AdmitQueue call={callRef.current} isHost={isHost} />}
        <RecordingReminder visible={recordingReminder} segment={recordingSegment} onStop={stopRecording} onSave={saveRecording} onDismiss={dismissRecordingReminder} onClearSegment={clearRecordingSegment} />

        {/* Floating-only mini controls, overlaid on the video itself. */}
        <div className="hidden">
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
    </PersistentCallWindow><ConfirmCallLeave open={confirmLeave} onOpenChange={setConfirmLeave} onLeave={() => { void leave(); }} /></>
  );
}

export default GlobalVideoCallHost;
