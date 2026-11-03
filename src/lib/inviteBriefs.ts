import { supabase } from "@/integrations/supabase/client";
import { parseBriefMessage, type CollabBrief } from "@/lib/collabBrief";

/**
 * The brief that came with each pending invitation, by project id. It travels in the notification the sender's request created (the
 * project_collaborators row has no column for it), so this reads the person's own notifications for those projects and keeps the newest
 * one that really carries a brief. Invitations sent before briefs were required simply have none, and the caller shows the project's own
 * description for those.
 */
export async function loadInviteBriefs(userId: string, projectIds: string[]): Promise<Map<string, CollabBrief>> {
  const briefs = new Map<string, CollabBrief>();
  if (!userId || projectIds.length === 0) return briefs;
  try {
    const { data } = await supabase
      .from("notifications")
      .select("link, message, created_at")
      .eq("user_id", userId)
      .eq("type", "project_invite")
      .in("link", projectIds.map((id) => `/desk/${id}`))
      .order("created_at", { ascending: false })
      .limit(100);
    for (const row of (data ?? []) as Array<{ link: string | null; message: string | null }>) {
      const projectId = row.link?.startsWith("/desk/") ? row.link.slice("/desk/".length) : null;
      if (!projectId || briefs.has(projectId)) continue;
      const brief = parseBriefMessage(row.message);
      if (brief) briefs.set(projectId, brief);
    }
  } catch {
    /* no briefs to show: the cards fall back to the project's description */
  }
  return briefs;
}
