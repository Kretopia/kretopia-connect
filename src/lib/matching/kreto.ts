// The app's side of Kreto reading a brief (supabase/functions/kreto-structure-need). Kreto only turns the brief into
// criteria: it never sees a profile and never ranks anyone. This module checks what comes back with the same schema the
// search uses (the function already rebuilt it, and the app does not trust that either), and turns every failure into one of
// a few kinds with words a person can act on, always ending in "or set the criteria yourself": the form stays usable.

import { matchNeedSchema, type MatchNeed } from "./need";

export const BRIEF_MIN = 10;
export const BRIEF_MAX = 800;

export type KretoErrorKind = "brief_invalid" | "rate_limited" | "ai_credits" | "timeout" | "no_criteria" | "invalid_output" | "unavailable";

export const KRETO_ERROR_COPY: Record<KretoErrorKind, string> = {
  brief_invalid: `Write at least a sentence (${BRIEF_MIN} to ${BRIEF_MAX} characters).`,
  rate_limited: "Kreto is busy. Try again in a minute, or set the criteria yourself.",
  ai_credits: "Kreto is unavailable right now. You can set the criteria yourself.",
  timeout: "Kreto took too long. Try again, or set the criteria yourself.",
  no_criteria: "Kreto found nothing to search by in that brief. Say what kind of creative you need, which skills or where, or set the criteria yourself.",
  invalid_output: "Kreto's answer could not be used. Try again, or set the criteria yourself.",
  unavailable: "Kreto can't be reached right now. You can set the criteria yourself.",
};

export class KretoNeedError extends Error {
  constructor(public kind: KretoErrorKind, public ignored: string[] = []) {
    super(KRETO_ERROR_COPY[kind]);
    this.name = "KretoNeedError";
  }
}

export interface KretoReading {
  need: MatchNeed;
  /** Parts of the brief Kreto did not use as criteria (budget, deadline...). Shown, never searched. */
  ignored: string[];
}

export interface InvokeClient {
  functions: { invoke: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }> };
}

const KINDS = new Set<string>(["brief_invalid", "rate_limited", "ai_credits", "timeout", "no_criteria", "invalid_output"]);

function ignoredList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, 80)).filter((v) => v.length >= 2).slice(0, 6);
}

/** The code and left-out parts the function put in its error body, when the error carries one. */
async function readErrorBody(error: unknown): Promise<{ code: string | null; ignored: string[] }> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = await context.clone().json();
      return { code: typeof body?.error === "string" ? body.error : null, ignored: ignoredList(body?.ignored) };
    } catch {
      /* not JSON: fall through */
    }
  }
  return { code: null, ignored: [] };
}

export async function requestNeedFromBrief(client: InvokeClient, brief: string): Promise<KretoReading> {
  const text = brief.trim();
  if (text.length < BRIEF_MIN || text.length > BRIEF_MAX) throw new KretoNeedError("brief_invalid");

  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke("kreto-structure-need", { body: { brief: text } });
  } catch {
    throw new KretoNeedError("unavailable");
  }

  if (result.error) {
    const { code, ignored } = await readErrorBody(result.error);
    throw new KretoNeedError(code && KINDS.has(code) ? (code as KretoErrorKind) : "unavailable", ignored);
  }

  const data = result.data as { need?: unknown; ignored?: unknown } | null;
  const parsed = matchNeedSchema.safeParse(data?.need);
  if (!parsed.success) throw new KretoNeedError("invalid_output");
  const n = parsed.data;
  if (!(n.craft || n.skills.length || n.themes.length || n.location || n.platforms.length || n.audience || n.backedWork)) {
    throw new KretoNeedError("no_criteria", ignoredList(data?.ignored));
  }
  return { need: n, ignored: ignoredList(data?.ignored) };
}
