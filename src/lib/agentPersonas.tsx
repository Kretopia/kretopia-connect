import { Compass, Hammer, Library, Handshake, Sparkles, type LucideIcon } from "lucide-react";

export type AgentPersona = "scout" | "producer" | "archivist" | "deal" | "orchestrator";

export interface PersonaMeta {
  id: AgentPersona;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Tailwind class for the persona accent color (token-based). */
  accent: string;
  /** Tailwind class for the small icon chip background. */
  chipBg: string;
}

export const PERSONAS: Record<AgentPersona, PersonaMeta> = {
  scout: {
    id: "scout",
    label: "Scout",
    tagline: "Finds people & gigs",
    icon: Compass,
    accent: "text-primary",
    chipBg: "bg-primary/15 text-primary",
  },
  producer: {
    id: "producer",
    label: "Producer",
    tagline: "Sets up your work",
    icon: Hammer,
    accent: "text-accent",
    chipBg: "bg-accent/15 text-accent",
  },
  archivist: {
    id: "archivist",
    label: "Archivist",
    tagline: "Logs credits & memory",
    icon: Library,
    accent: "text-secondary-foreground",
    chipBg: "bg-secondary/30 text-secondary-foreground",
  },
  deal: {
    id: "deal",
    label: "Deal",
    tagline: "Handles the money",
    icon: Handshake,
    accent: "text-[hsl(var(--energy))]",
    chipBg: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  },
  orchestrator: {
    id: "orchestrator",
    label: "Thrive",
    tagline: "Your operator",
    icon: Sparkles,
    accent: "text-primary",
    chipBg: "bg-primary/15 text-primary",
  },
};

export const personaFor = (p: string | null | undefined): PersonaMeta =>
  (p && PERSONAS[p as AgentPersona]) || PERSONAS.orchestrator;
