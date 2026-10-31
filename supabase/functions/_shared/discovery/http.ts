// Small HTTP helpers shared by the three external discovery edge functions. Pure.
import type { Outcome } from "./pipeline.ts";

import { corsFor } from "../guard.ts";

export const corsHeaders = (req: Request) => corsFor(req);

export const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsFor(req), "Content-Type": "application/json" } });

/** An outcome as a response: a refusal carries a code and a plain message, never an internal detail. */
export const respond = (req: Request, o: Outcome) => (o.ok ? json(req, { ok: true, ...(o.data ?? {}) }, o.status) : json(req, { ok: false, code: o.code, message: o.message, ...(o.data ?? {}) }, o.status));

export async function readJson(req: Request, maxBytes = 200_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The `sources` of a discovery run request: a list of up to eight source ids. Absent means every enabled source (null here); anything
 * else that is not such a list is refused (the string "invalid") rather than guessed at.
 */
export function parseRunSources(v: unknown): string[] | null | "invalid" {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length === 0 || v.length > 8) return "invalid";
  if (!v.every((s) => typeof s === "string" && /^[a-z0-9-]{1,32}$/.test(s))) return "invalid";
  return [...new Set(v as string[])];
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
