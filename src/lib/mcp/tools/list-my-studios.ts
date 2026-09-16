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
  name: "list_my_studios",
  title: "List my Studios",
  description:
    "List the signed-in user's Studios (projects) — active creative workspaces they own or created.",
  inputSchema: {
    status: z
      .enum(["active", "completed", "archived", "all"])
      .optional()
      .describe("Filter by status (default 'active')."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("projects")
      .select("id, title, description, status, workspace_type, mood, deadline, created_at, updated_at")
      .eq("created_by", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (status && status !== "all") q = q.eq("status", status);
    else if (!status) q = q.eq("status", "active");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { studios: data ?? [] },
    };
  },
});
