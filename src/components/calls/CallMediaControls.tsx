import { useEffect, useState, type ReactNode } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { Mic, MicOff, Video, VideoOff, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import kMark from "@/assets/brand/kretopia-k-mark.png.asset.json";

export function CallBrand() {
  return <span className="k-call-brand flex shrink-0 items-center gap-2"><span className="relative h-7 w-7 flex items-center justify-center"><span aria-hidden="true" className="k-gradient-text text-xl font-black">K</span><img src={kMark.url} alt="Kretopia" className="absolute inset-0 h-full w-full object-contain bg-background" onError={(event) => { event.currentTarget.hidden = true; }} /></span><span className="k-call-brand-name text-xs font-semibold">Kretopia</span></span>;
}

/** Presentation only: Daily remains authoritative for devices and sidebar state. */
/** `toolbar` renders the same controls icon-only for the top call bar, followed by `children` (share, record, leave...). */
export function CallMediaControls({ call, toolbar = false, children }: { call: DailyCall | null; toolbar?: boolean; children?: ReactNode }) {
  const [devices, setDevices] = useState({ audio: true, video: true });
  useEffect(() => {
    if (!call) return;
    const read = () => {
      const local = call.participants().local;
      if (local) setDevices({ audio: Boolean(local.audio), video: Boolean(local.video) });
    };
    read();
    call.on("participant-updated", read);
    call.on("joined-meeting", read);
    call.setActiveSpeakerMode(true);
    const updateTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const color = (token: string) => `hsl(${css.getPropertyValue(token).trim()})`;
      void call.setTheme({ colors: {
        accent: color("--primary"), accentText: color("--primary-foreground"),
        background: color("--background"), backgroundAccent: color("--secondary"),
        baseText: color("--foreground"), border: color("--border"),
        mainAreaBg: color("--background"), mainAreaBgAccent: color("--card"),
        mainAreaText: color("--foreground"), supportiveText: color("--muted-foreground"),
      } }).catch(() => {});
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => { observer.disconnect(); call.off("participant-updated", read); call.off("joined-meeting", read); };
  }, [call]);
  if (toolbar) {
    const icon = "k-call-icon rounded-lg bg-secondary text-foreground hover:bg-accent";
    return <div className="k-call-toolbar" role="toolbar" aria-label="Call controls">
      <Button variant="ghost" className={icon} title={devices.audio ? "Mute microphone" : "Unmute microphone"} disabled={!call} aria-label={devices.audio ? "Mute microphone" : "Unmute microphone"} aria-pressed={!devices.audio} onClick={() => { void call?.setLocalAudio(!devices.audio); }}>{devices.audio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</Button>
      <Button variant="ghost" className={icon} title={devices.video ? "Turn camera off" : "Turn camera on"} disabled={!call} aria-label={devices.video ? "Turn camera off" : "Turn camera on"} aria-pressed={devices.video} onClick={() => { void call?.setLocalVideo(!devices.video); }}>{devices.video ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}</Button>
      <Button variant="ghost" className={icon} title="Participants" disabled={!call} aria-label="Participants" onClick={() => call?.setSidebarView("people")}><Users className="h-4 w-4" /></Button>
      <Button variant="ghost" className={icon} title="Chat" disabled={!call} aria-label="Chat" onClick={() => call?.setSidebarView("chat")}><MessageSquare className="h-4 w-4" /></Button>
      {children}
    </div>;
  }
  return <div className="k-call-controls" aria-label="Audio, video and conversation controls">
    <Button variant="ghost" disabled={!call} aria-label={devices.audio ? "Mute microphone" : "Unmute microphone"} aria-pressed={!devices.audio} onClick={() => { void call?.setLocalAudio(!devices.audio); }}>
      {devices.audio ? <Mic /> : <MicOff />}<span>{devices.audio ? "Mute" : "Unmute"}</span>
    </Button>
    <Button variant="ghost" disabled={!call} aria-label={devices.video ? "Turn camera off" : "Turn camera on"} aria-pressed={devices.video} onClick={() => { void call?.setLocalVideo(!devices.video); }}>
      {devices.video ? <Video /> : <VideoOff />}<span>Camera</span>
    </Button>
    <Button variant="ghost" disabled={!call} aria-label="Participants" onClick={() => call?.setSidebarView("people")}><Users /><span>People</span></Button>
    <Button variant="ghost" disabled={!call} aria-label="Chat" onClick={() => call?.setSidebarView("chat")}><MessageSquare /><span>Chat</span></Button>
  </div>;
}