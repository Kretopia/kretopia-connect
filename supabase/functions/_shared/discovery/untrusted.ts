// How untrusted source text reaches a model, and what comes back. Pure.
//
// Rules this module enforces by construction:
//   * the extraction call carries NO tools and NO function definitions: the model can only return text, so injected
//     instructions have nothing to invoke;
//   * the source text sits inside labelled delimiters, with the existing prompt-isolation clause in the system prompt;
//   * what the model returns is parsed as JSON and validated by parseExtraction; the model's words never choose a URL
//     to fetch, a permission, or a field outside the schema;
//   * the amount of text sent is capped, so one paste cannot drive the cost.

import { PROMPT_INJECTION_DEFENSE_CLAUSE, wrapUntrustedContent } from "../promptIsolation.ts";
import { sanitizeText } from "./extract.ts";

export const MAX_SOURCE_CHARS = 12_000;

export const EXTRACTION_SYSTEM_PROMPT = `You extract ONE listing (a job or gig, an event, or a creative professional) from source text into a JSON object.
Return ONLY a JSON object with these keys and nothing else: kind ("gig" | "event" | "talent"), title, original_publisher, location, remote_scope ("remote" | "hybrid" | "onsite"), source_published_at, deadline_at, deadline_tz, budget ({min, max, currency, period}), apply_url, excerpt (at most 400 characters, in your own words), starts_at, ends_at, roles.
Rules: use null for anything the text does not state. Never guess a date, a budget, an employer or a URL. Dates are ISO 8601 and only when the text gives them. A budget needs an ISO 4217 currency code. Do not copy the full description; the excerpt is a short summary.
${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

/** The exact body sent to the gateway: a system prompt, the wrapped text, and no tools of any kind. */
export function buildExtractionRequest(sourceText: string, model: string, expectedKind?: string) {
  const text = (sanitizeText(sourceText, MAX_SOURCE_CHARS) ?? "").slice(0, MAX_SOURCE_CHARS);
  return {
    model,
    temperature: 0,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `${expectedKind ? `Expected kind: ${expectedKind}.\n` : ""}${wrapUntrustedContent("source text", text)}` },
    ],
  };
}

/** Pulls the JSON object out of a model answer. Anything else (prose, an array, a tool call) is not an extraction. */
export function parseModelJson(answer: unknown): unknown {
  if (typeof answer !== "string") return null;
  const trimmed = answer.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  if (!trimmed.startsWith("{")) return null;
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
