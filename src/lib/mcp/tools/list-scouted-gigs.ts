import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_scouted_gigs",
  title: "List Scout opportunities",
  description:
    "Returns the signed-in user's most recent Scout opportunities (AI-scouted gigs across the web).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max gigs to return (default 15)."),
    min_fit_score: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Only return gigs with fit_score >= this value."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ limit, min_fit_score }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("scouted_gigs")
      .select(
        "id, title, company, location, remote, compensation, deadline, apply_url, source, source_name, fit_score, fit_reason, description, scouted_at",
      )
      .eq("target_user_id", ctx.getUserId())
      .order("scouted_at", { ascending: false })
      .limit(limit ?? 15);
    if (typeof min_fit_score === "number") q = q.gte("fit_score", min_fit_score);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { gigs: data ?? [] },
    };
  },
});
