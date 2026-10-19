import { useEffect, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { Mic, MicOff, Video, VideoOff, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import kMark from "@/assets/brand/kretopia-k-mark.png.asset.json";

export function CallBrand() {
  return <span className="k-call-brand flex shrink-0 items-center gap-2"><span className="relative h-7 w-7 flex items-center justify-center"><span aria-hidden="true" className="k-gradient-text text-xl font-black">K</span><img src={kMark.url} alt="Kretopia" className="absolute inset-0 h-full w-full object-contain bg-background" onError={(event) => { event.currentTarget.hidden = true; }} /></span><span className="k-call-brand-name text-xs font-semibold">Kretopia</span></span>;
}

/** Presentation only: Daily remains authoritative for devices and sidebar state. */
export function CallMediaControls({ call }: { call: DailyCall | null }) {
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