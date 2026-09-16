import { supabase } from "@/integrations/supabase/client";

/**
 * Pings a collaborator that a deliverable was assigned to them.
 * Silent on failure — assignment shouldn't block on notification delivery.
 */
export async function notifyDeliverableAssigned(params: {
  projectId: string;
  projectTitle: string;
  deliverableId: string;
  deliverableTitle: string;
  assigneeId: string;
  actorId: string | null;
}) {
  if (params.assigneeId === params.actorId) return;
  await supabase
    .from("notifications")
    .insert({
      user_id: params.assigneeId,
      type: "deliverable_assigned",
      title: "You've got a new deliverable",
      message: `"${params.deliverableTitle}" in ${params.projectTitle}`,
      action_url: `/desk/${params.projectId}?focus=deliverable&id=${params.deliverableId}`,
      action_text: "Open deliverable",
      category: "project",
      priority: "normal",
    } as never)
    .then(
      () => {},
      () => {
        /* non-blocking */
      },
    );
}
