/**
 * Server copy of src/lib/collabBrief.ts: the rules for the brief a collaboration request must carry. Keep the two in step — a test runs the
 * same cases through both (src/lib/__tests__/collabBrief.test.ts). Pure functions, no imports, so it runs in Deno and in the tests alike.
 */
export interface CollabBrief {
  /** What the project is. */
  summary: string;
  /** Why the collaboration makes sense. */
  reason: string;
}
export type BriefField = keyof CollabBrief;
export type BriefErrors = Partial<Record<BriefField, string>>;

export const BRIEF_MIN_CHARS = 40;
export const BRIEF_MIN_WORDS = 6;
/** Distinct words: "test test test test test test" is six words and says nothing. */
export const BRIEF_MIN_DISTINCT_WORDS = 4;
export const BRIEF_MAX_CHARS = 600;

export const BRIEF_FIELD_LABEL: Record<BriefField, string> = {
  summary: "What the project is",
  reason: "Why this collaboration makes sense",
};

/** One paragraph: every run of whitespace (newlines included) becomes a single space. */
export function cleanBriefText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

const words = (text: string) => text.split(" ").filter(Boolean);
const letterCount = (text: string) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

function fieldError(field: BriefField, text: string): string | null {
  const label = BRIEF_FIELD_LABEL[field];
  if (!text) return `${label}: required.`;
  const w = words(text);
  const distinct = new Set(w.map((x) => x.toLowerCase())).size;
  if (text.length < BRIEF_MIN_CHARS || letterCount(text) < BRIEF_MIN_CHARS - 10 || w.length < BRIEF_MIN_WORDS || distinct < BRIEF_MIN_DISTINCT_WORDS) {
    return `${label}: say a little more — at least ${BRIEF_MIN_CHARS} characters in real sentences (now ${text.length}).`;
  }
  if (text.length > BRIEF_MAX_CHARS) return `${label}: keep it under ${BRIEF_MAX_CHARS} characters (now ${text.length}).`;
  return null;
}

export type BriefValidation = { ok: true; brief: CollabBrief } | { ok: false; errors: BriefErrors };

export function validateCollabBrief(input: Partial<Record<BriefField, unknown>> | null | undefined): BriefValidation {
  const brief: CollabBrief = { summary: cleanBriefText(input?.summary), reason: cleanBriefText(input?.reason) };
  const errors: BriefErrors = {};
  for (const field of ["summary", "reason"] as const) {
    const message = fieldError(field, brief[field]);
    if (message) errors[field] = message;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, brief };
}

const SUMMARY_MARK = "\n\nThe project: ";
const REASON_MARK = "\n\nWhy this collaboration: ";

/**
 * The request's text as the recipient reads it (notification, email): the headline, then the two fields, each a single paragraph so the
 * markers cannot appear inside a field.
 */
export function composeBriefMessage(headline: string, brief: CollabBrief): string {
  return `${cleanBriefText(headline)}${SUMMARY_MARK}${cleanBriefText(brief.summary)}${REASON_MARK}${cleanBriefText(brief.reason)}`;
}

/** The brief inside a message written by composeBriefMessage, or null for any other text (older requests carry none). */
export function parseBriefMessage(message: string | null | undefined): CollabBrief | null {
  if (typeof message !== "string") return null;
  const start = message.indexOf(SUMMARY_MARK);
  const split = message.indexOf(REASON_MARK, start + 1);
  if (start < 0 || split < 0) return null;
  const summary = message.slice(start + SUMMARY_MARK.length, split).trim();
  const reason = message.slice(split + REASON_MARK.length).trim();
  return summary && reason ? { summary, reason } : null;
}
