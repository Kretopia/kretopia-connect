import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GripHorizontal, Maximize2, Minimize2, Mic, MicOff, PhoneOff } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { CallBrand } from "./CallMediaControls";
import { PersonAvatar } from "@/components/media/PersonAvatar";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { liveRecordingCopy, type LiveRecordingPhase } from "@/lib/recordingState";
import { cn } from "@/lib/utils";

export type CallWindowMode = "full" | "floating" | "minimized";
const CallWindowContext = createContext<{ mode: CallWindowMode; rootRef: RefObject<HTMLDivElement> } | null>(null);
/** Where the call currently lives, for UI inside it that must not cover the window's own controls. Null outside a call window. */
export const useCallWindow = () => useContext(CallWindowContext);

export function ConfirmCallLeave({ open, onOpenChange, onLeave }: { open: boolean; onOpenChange: (open: boolean) => void; onLeave: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent className="z-[90] max-w-[calc(100vw-24px)] sm:max-w-sm rounded-lg"><AlertDialogTitle>Leave this call?</AlertDialogTitle><AlertDialogDescription>Your audio and video will disconnect. The other participants can continue.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Stay in call</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onLeave}>Leave call</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

/** Presentation only: keeps children (including the Daily iframe) in a stable slot. */
export function PersistentCallWindow({ children, route, title, call, startedAt, recordingPhase, status = "Live", onLeave, active = true }: {
  children: ReactNode; route: string; title: string; call: DailyCall | null; startedAt: number | null;
  recordingPhase: LiveRecordingPhase; status?: string; onLeave: () => void; active?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [audio, setAudio] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const docked = location.pathname === route && !minimized;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!call) return;
    const read = () => {
      const participants = Object.values(call.participants());
      setAudio(Boolean(call.participants().local?.audio));
      setNames(participants.filter(p => !p.local).map(p => p.user_name || "Participant").slice(0, 3));
    };
    read();
    call.on("participant-updated", read); call.on("participant-joined", read); call.on("participant-left", read);
    return () => { call.off("participant-updated", read); call.off("participant-joined", read); call.off("participant-left", read); };
  }, [call]);
  useEffect(() => {
    const clearPosition = () => { root.current?.style.removeProperty("--call-left"); root.current?.style.removeProperty("--call-top"); root.current?.style.removeProperty("--call-bottom"); };
    clearPosition(); window.addEventListener("resize", clearPosition);
    return () => window.removeEventListener("resize", clearPosition);
  }, [docked, minimized]);
  const seconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const recording = liveRecordingCopy(recordingPhase);
  const mode: CallWindowMode = docked ? "full" : minimized ? "minimized" : "floating";
  return <CallWindowContext.Provider value={{ mode, rootRef: root }}>
    <div ref={root} data-call-window={docked ? "full" : minimized ? "minimized" : "floating"} className={cn("k-call-surface k-persistent-call z-[60]", docked ? "fixed inset-0 flex flex-col" : "k-call-mini fixed flex flex-col rounded-lg border border-border shadow-xl", minimized && "k-call-mini-collapsed", !active && "hidden")}>
      <div hidden={docked} className={cn("k-call-mini-header", docked && "hidden")} onPointerDown={e => {
        if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button") || !window.matchMedia("(min-width: 768px)").matches) return;
        const bounds = root.current?.getBoundingClientRect(); if (!bounds) return;
        drag.current = { x: e.clientX, y: e.clientY, left: bounds.left, top: bounds.top }; e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => {
        const start = drag.current; const element = root.current; if (!start || !element) return;
        const left = Math.max(12, Math.min(window.innerWidth - element.offsetWidth - 12, start.left + e.clientX - start.x));
        const top = Math.max(80, Math.min(window.innerHeight - element.offsetHeight - 96, start.top + e.clientY - start.y));
        element.style.setProperty("--call-left", `${left}px`); element.style.setProperty("--call-top", `${top}px`);
        element.style.setProperty("--call-bottom", "auto");
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <GripHorizontal aria-hidden className="hidden md:block h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="k-call-mini-info min-w-0 flex-1"><CallBrand /><p className="k-call-mini-title truncate text-xs font-semibold mt-1">{title}</p><p role="status" aria-label={`${status}, ${elapsed}${recording ? `, ${recording.label}` : ""}`} className="truncate text-xs text-muted-foreground">
          <span className={status === "Live" ? "k-call-mini-word" : undefined}>{status} · </span>{elapsed}
          {recording && <><span aria-hidden className="k-call-mini-dot" /><span className="k-call-mini-word"> · {recording.label}</span></>}
        </p></div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" className="k-call-icon" title={audio ? "Mute microphone" : "Unmute microphone"} aria-label={audio ? "Mute microphone" : "Unmute microphone"} disabled={!call} onClick={() => { void call?.setLocalAudio(!audio); }}>{audio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</Button>
          <Button variant="ghost" className="k-call-icon" title="Return to full call" aria-label="Return to full call" onClick={() => { setMinimized(false); navigate(route); }}><Maximize2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="k-call-persistent-content flex flex-1 min-h-0 flex-col">{children}</div>
      <div hidden={docked} className={cn("k-call-mini-actions", docked && "hidden")}>
        <div className="k-call-mini-people flex items-center min-w-0 flex-1 gap-1 overflow-hidden">{names.map((name, index) => <PersonAvatar key={`${index}-${name}`} src={null} name={name} className="h-6 w-6" />)}<span className="truncate text-xs text-muted-foreground">{names.join(", ")}</span></div>
        <Button variant="ghost" className="k-call-icon k-call-mini-toggle" title={minimized ? "Expand miniature" : "Minimize call"} aria-label={minimized ? "Expand miniature" : "Minimize call"} onClick={() => setMinimized(v => !v)}>{minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</Button>
        <Button variant="ghost" className="k-call-icon text-destructive" title="Leave call" aria-label="Leave call" onClick={() => setConfirm(true)}><PhoneOff className="h-4 w-4" /></Button>
      </div>
      {docked && <Button variant="ghost" className="k-call-icon k-call-minimize right-3 top-[calc(var(--call-bar-h,60px)+env(safe-area-inset-top,0px))] z-20 bg-secondary" title="Minimize call" aria-label="Minimize call" onClick={() => setMinimized(true)}><Minimize2 className="h-4 w-4" /></Button>}
    </div>
    <ConfirmCallLeave open={confirm} onOpenChange={setConfirm} onLeave={onLeave} />
  </CallWindowContext.Provider>;
}