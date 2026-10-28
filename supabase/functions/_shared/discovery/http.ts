// Small HTTP helpers shared by the three external discovery edge functions. Pure.
import type { Outcome } from "./pipeline.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** An outcome as a response: a refusal carries a code and a plain message, never an internal detail. */
export const respond = (o: Outcome) => (o.ok ? json({ ok: true, ...(o.data ?? {}) }, o.status) : json({ ok: false, code: o.code, message: o.message, ...(o.data ?? {}) }, o.status));

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

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
