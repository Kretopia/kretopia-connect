// What Kreto can see, as the person chooses it in the composer, and how a reply says what it drew on. Labels only: the
// server (supabase/functions/_shared/kretoContext.ts) decides what is loaded. A test keeps the section ids in step.

import type { KretoSources } from "@/lib/thriveCopilot";

export const KRETO_CONTEXT_SECTIONS = ["passport", "projects", "money", "events"] as const;
export type KretoContextSection = (typeof KRETO_CONTEXT_SECTIONS)[number];

export const CONTEXT_SECTION_LABEL: Record<KretoContextSection, string> = {
  passport: "Passport",
  projects: "Projects",
  money: "Money",
  events: "Events",
};

export const CONTEXT_SECTION_HINT: Record<KretoContextSection, string> = {
  passport: "Bio, skills and credits.",
  projects: "Active projects, tasks and the open project's facts.",
  money: "Invoices, drafts and payments.",
  events: "Events you are hosting.",
};

export interface KretoContextChoice {
  /** "auto": what the message is about, the rest as a short summary. A list: only those, nothing else. */
  context: "auto" | KretoContextSection[];
  /** Use and learn from what Kreto remembers about you. */
  memory: boolean;
}

export const DEFAULT_CONTEXT_CHOICE: KretoContextChoice = { context: "auto", memory: true };

const isSection = (v: unknown): v is KretoContextSection =>
  typeof v === "string" && (KRETO_CONTEXT_SECTIONS as readonly string[]).includes(v);

const STORAGE_KEY = "kreto:context:v1";

/** The last choice on this device: falls back to Auto with memory on. */
export function readContextChoice(): KretoContextChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<KretoContextChoice> | null;
    const context = Array.isArray(raw?.context) ? KRETO_CONTEXT_SECTIONS.filter((s) => (raw!.context as unknown[]).includes(s)) : "auto";
    return { context, memory: raw?.memory !== false };
  } catch {
    return DEFAULT_CONTEXT_CHOICE;
  }
}

export function writeContextChoice(choice: KretoContextChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ context: Array.isArray(choice.context) ? choice.context.filter(isSection) : "auto", memory: choice.memory }));
  } catch {
    /* private window or blocked storage: the choice lasts for this page */
  }
}

/** The composer's short label: "Auto", "Projects, Money", "Nothing shared". */
export function contextChoiceLabel(choice: KretoContextChoice): string {
  if (choice.context === "auto") return "Auto";
  if (choice.context.length === 0) return "Identity only";
  return choice.context.map((s) => CONTEXT_SECTION_LABEL[s]).join(", ");
}

/** A reply's source line: "Projects, Money, 3 memories, project facts". Null when it drew on nothing beyond identity. */
export function sourcesLabel(sources: KretoSources | null | undefined): string | null {
  if (!sources) return null;
  const parts = sources.sections.filter(isSection).map((s) => CONTEXT_SECTION_LABEL[s]);
  if (sources.projectFacts) parts.push("project facts");
  if (sources.memories > 0) parts.push(sources.memories === 1 ? "1 memory" : `${sources.memories} memories`);
  return parts.length ? parts.join(", ") : null;
}
