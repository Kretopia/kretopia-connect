import { supabase } from "@/integrations/supabase/client";

/**
 * Pings every other collaborator when someone explicitly validates a
 * Studio phase and moves the project to the next one. Same fire-and-
 * forget shape as notifyDeliverableAssigned — a notification failure
 * should never block the phase change itself.
 */
export async function notifyPhaseAdvanced(params: {
  projectId: string;
  projectTitle: string;
  phaseLabel: string;
  collaboratorIds: string[];
  actorId: string;
}) {
  const recipients = params.collaboratorIds.filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;
  await Promise.all(
    recipients.map((userId) =>
      supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: "project_phase_advanced",
          title: `${params.phaseLabel} done`,
          message: `${params.projectTitle} moved into ${params.phaseLabel}.`,
          action_url: `/desk/${params.projectId}`,
          action_text: "Open project",
          category: "project",
          priority: "normal",
        } as never)
        .then(
          () => {},
          () => { /* non-blocking */ },
        ),
    ),
  );
}
