// Embeds a manually-added Copilot memory (CopilotMemory.tsx "Teach it
// something" form). Manual adds previously skipped embedding entirely, so
// they never surfaced via match_copilot_memories' semantic search until
// the user happened to re-mention the same topic in chat (which would
// dedupe into it). This function gives manual adds the same embed +
// dedupe path the automatic extractor already uses.
//
// Auth: requires user JWT (verify_jwt true — user can only write their own memories).

import { createClient } from "npm:@supabase/supabase-js@2";
import { embedText, toPgVector } from "../_shared/embed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_KINDS = new Set([
  "fact",
  "preference",
  "relationship",
  "working_style",
  "money",
  "project",
  "goal",
  "dislike",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (uErr || !userId) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 600) : "";
    if (!content) return json({ error: "content required" }, 400);
    const kind = ALLOWED_KINDS.has(body.kind ?? "") ? (body.kind as string) : "fact";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const embedding = await embedText(content);

    if (embedding) {
      const { data: dupes } = await admin.rpc("match_copilot_memories", {
        p_user_id: userId,
        p_query_embedding: toPgVector(embedding) as unknown as number[],
        p_match_count: 1,
        p_min_similarity: 0.88,
      });
      const dupe = Array.isArray(dupes) && dupes[0];

      if (dupe) {
        const newConf = Math.min(1, Math.max(dupe.confidence ?? 0.7, 1.0));
        const { data: updated, error } = await admin
          .from("copilot_memories")
          .update({
            confidence: newConf,
            content: content.length > (dupe.content?.length ?? 0) ? content : dupe.content,
            last_used_at: new Date().toISOString(),
            use_count: (dupe.use_count ?? 0) + 1,
          })
          .eq("id", dupe.id)
          .eq("user_id", userId)
          .select("id, kind, content, source, confidence, use_count, last_used_at, created_at")
          .single();
        if (error) throw error;
        return json({ ok: true, memory: updated, deduped: true });
      }
    }

    const { data: inserted, error } = await admin
      .from("copilot_memories")
      .insert({
        user_id: userId,
        kind,
        content,
        source: "manual",
        confidence: 1.0,
        ...(embedding ? { embedding: toPgVector(embedding) } : {}),
      })
      .select("id, kind, content, source, confidence, use_count, last_used_at, created_at")
      .single();
    if (error) throw error;

    return json({ ok: true, memory: inserted, embedded: !!embedding });
  } catch (e) {
    console.error("embed-copilot-memory error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
