// Thrive Memory Tool — handles `remember`, `recall_memory`, and `forget_memory`
// invoked by the Thrive Copilot planner/executor or directly from the chat agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "note";
}

const ALLOWED_KINDS = new Set([
  "vendor",
  "sponsor",
  "contact",
  "preference",
  "follow_up",
  "fact",
  "client",
  "rate",
  "note",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    // Accept `_tool` from executor or explicit `tool` from direct call
    const tool: string =
      String(body._tool ?? body.tool ?? "").trim() || "remember";

    // ----- recall_memory -----
    if (tool === "recall_memory" || tool === "recall") {
      const query: string = String(body.query ?? body.q ?? "").trim();
      const kind: string | undefined = body.kind ? String(body.kind) : undefined;
      const limit = Math.min(Number(body.limit ?? 8), 25);

      let q = admin
        .from("thrive_memory")
        .select("id, kind, label, body, importance, last_used_at, created_at")
        .eq("user_id", user.id)
        .order("importance", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (kind) q = q.eq("kind", kind);
      if (query) {
        // Loose ilike across label/body
        q = q.or(`label.ilike.%${query}%,body.ilike.%${query}%`);
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);

      // Bump last_used_at for returned rows (fire-and-forget)
      if (data && data.length) {
        const ids = data.map((r) => r.id);
        admin
          .from("thrive_memory")
          .update({ last_used_at: new Date().toISOString() })
          .in("id", ids)
          .then(() => {}, () => {});
      }

      return json({
        ok: true,
        count: data?.length ?? 0,
        memories: data ?? [],
      });
    }

    // ----- forget_memory -----
    if (tool === "forget_memory" || tool === "forget") {
      const id: string | undefined = body.memory_id ?? body.id;
      const mem_key: string | undefined = body.mem_key;
      const kind: string | undefined = body.kind;

      let del = admin.from("thrive_memory").delete().eq("user_id", user.id);
      if (id) del = del.eq("id", id);
      else if (mem_key && kind) del = del.eq("mem_key", mem_key).eq("kind", kind);
      else return json({ error: "memory_id OR (mem_key + kind) required" }, 400);

      const { error, count } = await del.select("id", { count: "exact" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, deleted: count ?? 0 });
    }

    // ----- remember (default) -----
    const label: string = String(body.label ?? body.title ?? "").trim();
    const memBody: string = String(body.body ?? body.content ?? body.value ?? "").trim();
    const rawKind: string = String(body.kind ?? "note").trim().toLowerCase();
    const kind = ALLOWED_KINDS.has(rawKind) ? rawKind : "note";
    const importance = Math.max(1, Math.min(Number(body.importance ?? 2), 5));
    const context = (body.context && typeof body.context === "object") ? body.context : {};
    const mem_key = String(body.mem_key ?? slugify(label || memBody.slice(0, 60)));

    if (!label && !memBody) return json({ error: "label or body required" }, 400);

    const row = {
      user_id: user.id,
      kind,
      mem_key,
      label: label || memBody.slice(0, 80),
      body: memBody || null,
      context,
      importance,
      last_used_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("thrive_memory")
      .upsert(row, { onConflict: "user_id,kind,mem_key" })
      .select("id, kind, mem_key, label, body, importance")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, memory: data });
  } catch (e) {
    console.error("thrive-memory-tool error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
