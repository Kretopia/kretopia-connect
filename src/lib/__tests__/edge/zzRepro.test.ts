import { beforeAll, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
const world = vi.hoisted(() => ({ handler: null as null | ((r: Request) => Promise<Response>), db: null as any }));
vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({ createClient: () => ({ from: (t: string) => world.db.from(t) }) }));
vi.mock("../../../../supabase/functions/_shared/embed.ts", () => ({ embedText: async () => null, toPgVector: () => "[]" }));
const KEY = "service-key";
const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: KEY, DAILY_API_KEY: "daily-key", LOVABLE_API_KEY: "ai-key" };
beforeAll(async () => {
  (AbortSignal as any).timeout ??= () => new AbortController().signal;
  (globalThis as any).Deno ={ env: { get: (k: string) => ENV[k] } };
  await import("../../../../supabase/functions/transcribe-call/index.ts");
});
it("repro too_large", async () => {
  world.db = new MemoryDb().seed("call_transcripts", [{ id: "t1", recording_id: "rec-1", call_kind: "project", call_id: "c1", created_by: "host-1", status: "pending", error: null, participants: [], duration_seconds: 90 }]);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("/access-link")) return new Response(JSON.stringify({ download_link: "https://dl.example/rec.mp4" }), { status: 200 });
    if (String(url).startsWith("https://dl.example")) return new Response(new Uint8Array(8), { status: 200, headers: { "content-length": String(40 * 1024 * 1024) } });
    throw new Error("unscripted " + url);
  }));
  const res = await world.handler!(new Request("https://fn.example/t", { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ transcript_id: "t1", recording_id: "rec-1" }) }));
  console.log("STATUS", res.status, "BODY", await res.text());
  expect(true).toBe(true);
});
