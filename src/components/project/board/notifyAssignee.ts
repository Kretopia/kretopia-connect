import { notifyDeliverableAssignedTo } from "@/lib/studioNotifications";

/**
 * Pings a collaborator that a deliverable was assigned to them.
 * Silent on failure — assignment shouldn't block on notification delivery.
 *
 * This used to insert straight into `notifications` from the browser, which
 * RLS rejects for another user's row (and the error was swallowed), so the
 * assignee was never actually notified. It now goes through the
 * create_notification RPC like every other cross-user notification.
 */
export async function notifyDeliverableAssigned(params: {
  projectId: string;
  projectTitle: string;
  deliverableId: string;
  deliverableTitle: string;
  assigneeId: string;
  actorId: string | null;
}) {
  await notifyDeliverableAssignedTo({
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    deliverableTitle: params.deliverableTitle,
    assigneeId: params.assigneeId,
    actorId: params.actorId,
  });
}
