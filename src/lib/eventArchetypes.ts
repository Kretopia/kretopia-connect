// Event archetypes — drive default workspace setup, modules, AI prompt seeding.
// Picked from CreateSessionDialog when "Full Production Workspace" is on.

import {
  Wine, Mic, Music2, Sparkles, Headphones, GraduationCap, PartyPopper,
  Hammer, Heart, Users, Music, Briefcase, type LucideIcon,
} from "lucide-react";

export type EventArchetypeId =
  | "networking_dinner"
  | "conference"
  | "festival"
  | "brand_activation"
  | "podcast_event"
  | "masterclass"
  | "launch_party"
  | "workshop"
  | "wedding"
  | "creator_meetup"
  | "music_event"
  | "corporate_event";

export interface EventArchetype {
  id: EventArchetypeId;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /** Maps to creative_jams.category */
  category: string;
  /** Default tags appended to the event */
  defaultTags: string[];
  /** Modules/sections highlighted in the Studio (informational, drives copy & nudges) */
  modules: Array<"runsheet" | "suppliers" | "talent" | "sponsors" | "seating" | "content">;
  /** Producer agent system addendum used at workspace setup */
  producerPrompt: string;
}

export const EVENT_ARCHETYPES: EventArchetype[] = [
  {
    id: "networking_dinner",
    label: "Networking Dinner",
    icon: Wine,
    blurb: "Curated table, intentional intros, beautiful flow.",
    category: "networking",
    defaultTags: ["networking", "dinner", "intimate"],
    modules: ["runsheet", "seating", "talent"],
    producerPrompt:
      "Producing an intimate networking dinner. Focus on guest curation, seating intelligence, table-talk prompts, dietary handling, and a tight 3-act flow (arrival, dinner, mingling).",
  },
  {
    id: "conference",
    label: "Conference",
    icon: Mic,
    blurb: "Multi-stage program, speakers, sponsors, registration.",
    category: "workshop",
    defaultTags: ["conference", "speakers", "sponsors"],
    modules: ["runsheet", "talent", "sponsors", "suppliers", "content"],
    producerPrompt:
      "Producing a conference. Focus on multi-stage scheduling, speaker logistics, sponsor deliverables, AV needs, registration desk, and content capture.",
  },
  {
    id: "festival",
    label: "Festival",
    icon: PartyPopper,
    blurb: "Multi-act lineup, vendors, production, security.",
    category: "festival",
    defaultTags: ["festival", "lineup", "outdoor"],
    modules: ["runsheet", "talent", "suppliers", "sponsors", "content"],
    producerPrompt:
      "Producing a festival. Focus on artist lineup, stage scheduling, supplier coordination (sound, lights, staging), security, vendor zone, and crowd flow.",
  },
  {
    id: "brand_activation",
    label: "Brand Activation",
    icon: Sparkles,
    blurb: "Experiential moment for a brand or sponsor.",
    category: "showcase",
    defaultTags: ["brand", "activation", "experiential"],
    modules: ["runsheet", "suppliers", "content", "sponsors"],
    producerPrompt:
      "Producing a brand activation. Focus on the brand brief, experiential moments, content capture for socials, KPI tracking, and supplier coordination.",
  },
  {
    id: "podcast_event",
    label: "Podcast Event",
    icon: Headphones,
    blurb: "Live recording, intimate audience, polished AV.",
    category: "podcast",
    defaultTags: ["podcast", "live recording"],
    modules: ["runsheet", "talent", "content"],
    producerPrompt:
      "Producing a live podcast event. Focus on guest prep, recording setup (mics, cameras), audience flow, and post-event clip plan.",
  },
  {
    id: "masterclass",
    label: "Masterclass",
    icon: GraduationCap,
    blurb: "Educational deep-dive with one host or expert.",
    category: "workshop",
    defaultTags: ["masterclass", "education"],
    modules: ["runsheet", "content"],
    producerPrompt:
      "Producing a masterclass. Focus on curriculum flow, AV setup, attendee materials, and replay/recording capture.",
  },
  {
    id: "launch_party",
    label: "Launch Party",
    icon: PartyPopper,
    blurb: "Product or brand reveal with media moment.",
    category: "showcase",
    defaultTags: ["launch", "party", "press"],
    modules: ["runsheet", "talent", "suppliers", "content", "sponsors"],
    producerPrompt:
      "Producing a launch party. Focus on press list, the reveal moment, product flow, content capture, and after-party.",
  },
  {
    id: "workshop",
    label: "Workshop",
    icon: Hammer,
    blurb: "Hands-on session with materials and small group.",
    category: "workshop",
    defaultTags: ["workshop", "hands-on"],
    modules: ["runsheet", "suppliers"],
    producerPrompt:
      "Producing a hands-on workshop. Focus on materials, attendee skill level, time blocks, and take-home outcome.",
  },
  {
    id: "wedding",
    label: "Wedding",
    icon: Heart,
    blurb: "Ceremony, reception, vendors, guest flow.",
    category: "general",
    defaultTags: ["wedding", "ceremony", "reception"],
    modules: ["runsheet", "suppliers", "talent", "seating", "content"],
    producerPrompt:
      "Producing a wedding. Focus on ceremony + reception flow, vendor lineup (florals, catering, AV, photo/video), seating chart, and family logistics.",
  },
  {
    id: "creator_meetup",
    label: "Creator Meetup",
    icon: Users,
    blurb: "Casual, community-driven gathering for creators.",
    category: "networking",
    defaultTags: ["meetup", "creators", "community"],
    modules: ["runsheet"],
    producerPrompt:
      "Producing a creator meetup. Focus on warm welcome, light structure, intro prompts, and post-event follow-up matching.",
  },
  {
    id: "music_event",
    label: "Music Event",
    icon: Music,
    blurb: "Live performance, DJ night, concert.",
    category: "music",
    defaultTags: ["music", "live", "performance"],
    modules: ["runsheet", "talent", "suppliers", "content"],
    producerPrompt:
      "Producing a music event. Focus on artist lineup + set times, tech rider, sound check, door flow, and content capture.",
  },
  {
    id: "corporate_event",
    label: "Corporate Event",
    icon: Briefcase,
    blurb: "Off-site, town-hall, kickoff or partner event.",
    category: "general",
    defaultTags: ["corporate", "professional"],
    modules: ["runsheet", "talent", "suppliers", "content"],
    producerPrompt:
      "Producing a corporate event. Focus on agenda, speaker prep, AV, branded environment, and exec logistics.",
  },
];

export const findArchetype = (id: EventArchetypeId | string | null | undefined): EventArchetype | null =>
  EVENT_ARCHETYPES.find((a) => a.id === id) ?? null;
