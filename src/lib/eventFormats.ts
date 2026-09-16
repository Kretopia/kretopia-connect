// Event format taxonomy: caps, copy, Daily room behavior.
// Used by event create/edit + the join card + the create-event-room edge fn.

import { Users, Mic, Clapperboard, Headphones, type LucideIcon } from "lucide-react";

export type EventMode = "irl" | "online" | "hybrid";
export type OnlineFormat = "group_room" | "stage" | "watch_party" | "podcast";

export interface OnlineFormatConfig {
  value: OnlineFormat;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
  defaultCap: number;
  minCap: number;
  maxCap: number;
  /** "Audience can be on camera" — false means audience joins listen-only. */
  audienceOnCam: boolean;
  /** Whether recording defaults on. */
  recordsByDefault: boolean;
  /** Best-for examples shown in the picker. */
  bestFor: string;
}

export const ONLINE_FORMATS: OnlineFormatConfig[] = [
  {
    value: "group_room",
    label: "Group Room",
    short: "Everyone on cam",
    icon: Users,
    description: "Everyone sees and hears each other. Like a Zoom workshop.",
    defaultCap: 25,
    minCap: 2,
    maxCap: 50,
    audienceOnCam: true,
    recordsByDefault: false,
    bestFor: "Workshops, classes, coaching circles, jam sessions",
  },
  {
    value: "stage",
    label: "Stage",
    short: "Hosts present, audience watches",
    icon: Mic,
    description: "You + co-hosts go on stage. Audience watches and chats. Promote guests on the fly.",
    defaultCap: 200,
    minCap: 5,
    maxCap: 500,
    audienceOnCam: false,
    recordsByDefault: false,
    bestFor: "Masterclasses, panels, Q&A, talks",
  },
  {
    value: "watch_party",
    label: "Watch Party",
    short: "Watch a video together",
    icon: Clapperboard,
    description: "Drop a YouTube/Vimeo link. Everyone watches together with live chat & reactions.",
    defaultCap: 100,
    minCap: 2,
    maxCap: 500,
    audienceOnCam: false,
    recordsByDefault: false,
    bestFor: "Screenings, premieres, podcast drops, music releases",
  },
  {
    value: "podcast",
    label: "Podcast / Interview",
    short: "Recorded conversation",
    icon: Headphones,
    description: "2–4 on cam, auto-recorded. Repurpose for podcast, clips, or YouTube.",
    defaultCap: 4,
    minCap: 2,
    maxCap: 6,
    audienceOnCam: true,
    recordsByDefault: true,
    bestFor: "Interviews, podcast recordings, fireside chats",
  },
];

export const getFormatConfig = (f: OnlineFormat | null | undefined): OnlineFormatConfig | null =>
  ONLINE_FORMATS.find((x) => x.value === f) ?? null;

export const formatCapacityLine = (
  format: OnlineFormat | null | undefined,
  cap: number | null | undefined,
): string => {
  const cfg = getFormatConfig(format);
  if (!cfg) return "";
  const n = cap ?? cfg.defaultCap;
  if (cfg.value === "stage" || cfg.value === "watch_party") {
    return `${cfg.label} · up to ${n} watching`;
  }
  return `${cfg.label} · up to ${n} on cam`;
};

export const eventModeLabel = (mode: EventMode): string =>
  mode === "irl" ? "In person" : mode === "online" ? "Online" : "Hybrid";
