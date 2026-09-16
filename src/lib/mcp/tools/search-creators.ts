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
  name: "search_creators",
  title: "Search creators on Kretopia",
  description:
    "Search the Kretopia creative universe by name, role, skill, or location. Returns public Passport summaries.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Free-text search: name, role, skill, or city."),
    limit: z.number().int().min(1).max(25).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const cap = limit ?? 10;
    const q = `%${query}%`;
    const { data, error } = await sb
      .from("profiles")
      .select("user_id, full_name, role, job_title, industry, location, bio, avatar_url, badge, level")
      .or(
        `full_name.ilike.${q},role.ilike.${q},job_title.ilike.${q},industry.ilike.${q},location.ilike.${q}`,
      )
      .limit(cap);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { creators: data ?? [] },
    };
  },
});
