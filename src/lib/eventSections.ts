import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isMissingRelation } from "@/lib/eventCalendar";

/**
 * The host-editable sections of an Event page (public.event_page_sections): Program (line-up), Venue notes, Policies and FAQ. Each has the
 * host's words and a show/hide switch. Hiding keeps the words. The table is readable by the host only; everyone else reads a view that
 * returns the visibility flag of every section but the words of a visible one only, so the words of a hidden section cannot reach another
 * page, an export or a direct read, and the page can still tell that a section (the Venue, say) is hidden. A section with no row keeps the
 * page's default text, so old events look as before.
 *
 * The event's own address is a column of creative_jams and stays readable as it always was: hiding the Venue section keeps it off the
 * pages and exports this app draws (the hero, the calendar exports, the structured data), but it is not an access control for that column.
 *
 * Like the calendar table it is not in the generated types until its migration is applied, so it is reached through an untyped client and
 * says "unavailable" until it exists.
 */
// A client without the generated types: the table is not in them until its migration has been applied and they are regenerated.
const untyped = supabase as unknown as SupabaseClient;

export const EVENT_SECTION_KEYS = ["program", "venue", "policies", "faq"] as const;
export type EventSectionKey = (typeof EVENT_SECTION_KEYS)[number];

export const SECTION_LABELS: Record<EventSectionKey, string> = {
  program: "Program / line-up",
  venue: "Venue",
  policies: "Policies",
  faq: "FAQ",
};

export const SECTION_LIMITS = { text: 4000, faqItems: 20, question: 200, answer: 1000 } as const;

export interface FaqItem {
  question: string;
  answer: string;
}

/** One section as the host edits it. `text` is used by program, venue and policies; `faq` by the FAQ. */
export interface EventSection {
  visible: boolean;
  text: string;
  faq: FaqItem[];
  /** The host has saved this section (a row exists), as opposed to the page's default. */
  stored: boolean;
}

export type EventSections = Record<EventSectionKey, EventSection>;

export interface SectionRow {
  event_id?: string;
  section: string;
  content: unknown;
  is_visible: boolean;
}

export const emptySections = (): EventSections => ({
  program: { visible: true, text: "", faq: [], stored: false },
  venue: { visible: true, text: "", faq: [], stored: false },
  policies: { visible: true, text: "", faq: [], stored: false },
  faq: { visible: true, text: "", faq: [], stored: false },
});

const isKey = (value: string): value is EventSectionKey => (EVENT_SECTION_KEYS as readonly string[]).includes(value);
const asText = (value: unknown) => (typeof value === "string" ? value : "");

/** The sections of an event from the rows the database returned (a hidden section only comes back for the host). */
export function sectionsFromRows(rows: SectionRow[] | null | undefined): EventSections {
  const sections = emptySections();
  for (const row of rows ?? []) {
    if (!isKey(row.section)) continue;
    const content = (row.content && typeof row.content === "object" ? row.content : {}) as { text?: unknown; items?: unknown };
    const items = Array.isArray(content.items) ? content.items : [];
    sections[row.section] = {
      visible: row.is_visible !== false,
      text: asText(content.text),
      faq: items
        .map((item) => ({ question: asText((item as FaqItem)?.question), answer: asText((item as FaqItem)?.answer) }))
        .filter((item) => item.question.trim() || item.answer.trim()),
      stored: true,
    };
  }
  return sections;
}

/** Has the host written anything in this section (as opposed to leaving the default)? */
export const hasCustomContent = (key: EventSectionKey, section: EventSection): boolean =>
  section.stored && (key === "faq" ? section.faq.length > 0 : section.text.trim().length > 0);

export interface SectionView {
  /** Draw the section at all. */
  show: boolean;
  /** The host wrote this section. When false, the page's default text is shown. */
  custom: boolean;
  /** Only the host is seeing it: it is hidden from visitors. */
  hiddenFromVisitors: boolean;
}

/** What a viewer gets of a section: a visitor gets nothing of a hidden one; the host sees it, marked, so it can be edited and turned back on. */
export function viewSection(key: EventSectionKey, section: EventSection, isHost: boolean): SectionView {
  const hidden = !section.visible;
  return { show: !hidden || isHost, custom: hasCustomContent(key, section), hiddenFromVisitors: hidden };
}

/** The first thing wrong with what the host typed, or null. The same limits are enforced again by the table. */
export function validateSections(sections: EventSections): string | null {
  for (const key of EVENT_SECTION_KEYS) {
    const section = sections[key];
    if (key === "faq") {
      if (section.faq.length > SECTION_LIMITS.faqItems) return `The FAQ can have at most ${SECTION_LIMITS.faqItems} questions.`;
      for (const item of section.faq) {
        if (!item.question.trim() || !item.answer.trim()) return "Each FAQ entry needs a question and an answer.";
        if (item.question.length > SECTION_LIMITS.question) return `A question can have at most ${SECTION_LIMITS.question} characters.`;
        if (item.answer.length > SECTION_LIMITS.answer) return `An answer can have at most ${SECTION_LIMITS.answer} characters.`;
      }
    } else if (section.text.length > SECTION_LIMITS.text) {
      return `${SECTION_LABELS[key]} can have at most ${SECTION_LIMITS.text} characters.`;
    }
  }
  return null;
}

/** The row to store for one section. Whitespace-only text is stored as empty, so it falls back to the default. */
export function rowForSection(eventId: string, key: EventSectionKey, section: EventSection, userId: string) {
  const content = key === "faq"
    ? { items: section.faq.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })).filter((item) => item.question && item.answer) }
    : { text: section.text.trim() };
  return { event_id: eventId, section: key, content, is_visible: section.visible, updated_by: userId, updated_at: new Date().toISOString() };
}

export interface FetchedSections {
  sections: EventSections;
  /** False until the table exists. */
  available: boolean;
  /** The table exists but could not be read just now. The page keeps its defaults, and the editor must not save over what it could not see. */
  loadFailed: boolean;
}

/**
 * The host reads the table, which holds every section with its words. Everyone else reads the public view, which gives every section's
 * visibility flag but the words of a visible section only.
 */
export async function fetchEventSections(eventId: string, asHost = false): Promise<FetchedSections> {
  const source = asHost ? "event_page_sections" : "event_page_sections_public";
  try {
    const { data, error } = await untyped.from(source).select("section, content, is_visible").eq("event_id", eventId);
    if (error) {
      // Either way the page keeps its default text rather than showing nothing.
      return isMissingRelation(error)
        ? { sections: emptySections(), available: false, loadFailed: false }
        : { sections: emptySections(), available: true, loadFailed: true };
    }
    return { sections: sectionsFromRows(data), available: true, loadFailed: false };
  } catch {
    return { sections: emptySections(), available: true, loadFailed: true };
  }
}

export type SaveSectionsResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "signed-out" | "unavailable" | "failed"; message: string };

/** Saves all four sections for the event's host. Hiding is a flag on the row; the words are always kept. */
export async function saveEventSections(eventId: string, userId: string | null, sections: EventSections): Promise<SaveSectionsResult> {
  if (!userId) return { ok: false, reason: "signed-out", message: "Sign in to edit this event." };
  const invalid = validateSections(sections);
  if (invalid) return { ok: false, reason: "invalid", message: invalid };
  const rows = EVENT_SECTION_KEYS.map((key) => rowForSection(eventId, key, sections[key], userId));
  const { error } = await untyped.from("event_page_sections").upsert(rows, { onConflict: "event_id,section" });
  if (!error) return { ok: true };
  if (isMissingRelation(error)) return { ok: false, reason: "unavailable", message: "Editing page sections isn't available yet." };
  return { ok: false, reason: "failed", message: error.message || "The sections could not be saved." };
}
