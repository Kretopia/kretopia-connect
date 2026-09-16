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
  name: "list_my_credits",
  title: "List my Stamps (credits)",
  description:
    "Returns the signed-in user's verified Kretopia Stamps — IMDb-style credits for creative work.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max credits (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("credits")
      .select(
        "id, project_name, role, year, platform, url, thumbnail_url, verification_status, credit_category, client_brand, description, is_featured, created_at",
      )
      .eq("user_id", ctx.getUserId())
      .order("year", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { credits: data ?? [] },
    };
  },
});
