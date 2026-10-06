import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notifyUser";

/**
 * In-app notifications for key Studio events.
 *
 * Event            | Audience                                   | Link
 * -----------------|--------------------------------------------|----------------
 * Project message  | owner + accepted collaborators (DB trigger)| ?tab=messages
 * Review requested | owner + accepted `client` collaborators    | ?tab=brief
 * Review decision  | whoever submitted / is assigned the item   | ?tab=brief
 * Task assigned    | the assignee                               | ?tab=tasks
 * Booking          | the host (book-meeting edge function)      | /meet/:id
 *
 * Cross-user notifications go through the create_notification RPC (via
 * notifyUser): a direct insert from the browser is blocked by RLS. Everything
 * here is best-effort and never throws, and nobody is ever notified of their
 * own action.
 */

// Deep-link contract between notification links and the Studio page
// (ThriveDesk reads ?tab=). Only tabs that every member may already open.
export const DEEP_LINK_TABS = ["messages", "tasks", "files", "schedule", "brief"] as const;
export type DeepLinkTab = (typeof DEEP_LINK_TABS)[number];

export const studioLink = (projectId: string, tab: DeepLinkTab) => `/desk/${projectId}?tab=${tab}`;

export function parseDeepLinkTab(value: string | null | undefined): DeepLinkTab | null {
  return (DEEP_LINK_TABS as readonly string[]).includes(value ?? "") ? (value as DeepLinkTab) : null;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

type Built = Parameters<typeof notifyUser>[0];
type Draft = Omit<Built, "userId">;

export function reviewRequestedDraft(p: { projectId: string; projectTitle: string; deliverableTitle: string }): Draft {
  return {
    title: "Ready for your review",
    message: `"${truncate(p.deliverableTitle, 80)}" in ${p.projectTitle}`,
    type: "deliverable_review_requested",
    link: studioLink(p.projectId, "brief"),
    actionUrl: studioLink(p.projectId, "brief"),
    actionText: "Review deliverable",
    category: "project",
    priority: "high",
  };
}

export function deliverableDecisionDraft(p: {
  projectId: string; projectTitle: string; deliverableTitle: string; decision: "approved" | "rejected"; note?: string | null;
}): Draft {
  const note = p.note?.trim();
  const approved = p.decision === "approved";
  return {
    title: approved ? "Deliverable approved" : "Changes requested",
    message: `"${truncate(p.deliverableTitle, 80)}" in ${p.projectTitle}${!approved && note ? ` — ${truncate(note, 100)}` : ""}`,
    type: approved ? "deliverable_approved" : "deliverable_changes_requested",
    link: studioLink(p.projectId, "brief"),
    actionUrl: studioLink(p.projectId, "brief"),
    actionText: "Open deliverable",
    category: "project",
    priority: approved ? "normal" : "high",
  };
}

export function deliverableAssignedDraft(p: { projectId: string; projectTitle: string; deliverableTitle: string }): Draft {
  return {
    title: "You've got a new deliverable",
    message: `"${truncate(p.deliverableTitle, 80)}" in ${p.projectTitle}`,
    type: "deliverable_assigned",
    link: studioLink(p.projectId, "brief"),
    actionUrl: studioLink(p.projectId, "brief"),
    actionText: "Open deliverable",
    category: "project",
    priority: "normal",
  };
}

export function taskAssignedDraft(p: { projectId: string; projectTitle: string; taskTitle: string }): Draft {
  return {
    title: "New task assigned to you",
    message: `"${truncate(p.taskTitle, 80)}" in ${p.projectTitle}`,
    type: "task_assigned",
    link: studioLink(p.projectId, "tasks"),
    actionUrl: studioLink(p.projectId, "tasks"),
    actionText: "Open task",
    category: "project",
    priority: "normal",
  };
}

/** Unique recipients, never the person who did the thing, never empty ids. */
export function pickRecipients(ids: Array<string | null | undefined>, actorId: string | null | undefined): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id && id !== actorId)));
}

async function projectTitleFor(projectId: string, provided?: string | null): Promise<string> {
  if (provided?.trim()) return provided.trim();
  try {
    const { data } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
    return data?.title || "your project";
  } catch {
    return "your project";
  }
}

async function sendAll(recipients: string[], draft: Draft) {
  await Promise.all(recipients.map((userId) => notifyUser({ ...draft, userId })));
}

/** Who is asked to review: the project owner and accepted `client` collaborators. */
async function reviewersFor(projectId: string, actorId: string | null): Promise<string[]> {
  try {
    const [{ data: project }, { data: clients }] = await Promise.all([
      supabase.from("projects").select("created_by").eq("id", projectId).maybeSingle(),
      supabase.from("project_collaborators").select("user_id").eq("project_id", projectId).eq("status", "accepted").eq("role", "client"),
    ]);
    return pickRecipients([project?.created_by, ...(clients ?? []).map((c) => c.user_id)], actorId);
  } catch {
    return [];
  }
}

export async function notifyReviewRequested(p: {
  projectId: string; projectTitle?: string | null; deliverableTitle: string; actorId: string | null;
}): Promise<void> {
  const [recipients, projectTitle] = await Promise.all([reviewersFor(p.projectId, p.actorId), projectTitleFor(p.projectId, p.projectTitle)]);
  if (!recipients.length) return;
  await sendAll(recipients, reviewRequestedDraft({ projectId: p.projectId, projectTitle, deliverableTitle: p.deliverableTitle }));
}

export async function notifyDeliverableDecision(p: {
  projectId: string; projectTitle?: string | null; deliverableTitle: string; decision: "approved" | "rejected";
  note?: string | null; recipientIds: Array<string | null | undefined>; actorId: string | null;
}): Promise<void> {
  const recipients = pickRecipients(p.recipientIds, p.actorId);
  if (!recipients.length) return;
  const projectTitle = await projectTitleFor(p.projectId, p.projectTitle);
  await sendAll(recipients, deliverableDecisionDraft({
    projectId: p.projectId, projectTitle, deliverableTitle: p.deliverableTitle, decision: p.decision, note: p.note,
  }));
}

export async function notifyDeliverableAssignedTo(p: {
  projectId: string; projectTitle?: string | null; deliverableTitle: string; assigneeId: string; actorId: string | null;
}): Promise<void> {
  const recipients = pickRecipients([p.assigneeId], p.actorId);
  if (!recipients.length) return;
  const projectTitle = await projectTitleFor(p.projectId, p.projectTitle);
  await sendAll(recipients, deliverableAssignedDraft({ projectId: p.projectId, projectTitle, deliverableTitle: p.deliverableTitle }));
}

export async function notifyTaskAssigned(p: {
  projectId: string; projectTitle?: string | null; taskTitle: string; assigneeId: string | null | undefined; actorId: string | null;
}): Promise<void> {
  const recipients = pickRecipients([p.assigneeId], p.actorId);
  if (!recipients.length) return;
  const projectTitle = await projectTitleFor(p.projectId, p.projectTitle);
  await sendAll(recipients, taskAssignedDraft({ projectId: p.projectId, projectTitle, taskTitle: p.taskTitle }));
}
