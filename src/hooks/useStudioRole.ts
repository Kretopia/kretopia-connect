import { useMemo } from "react";

export type StudioRole = "owner" | "creative" | "collaborator" | "client" | "guest";

export interface StudioPermissions {
  role: StudioRole;
  isOwner: boolean;
  /** Can see and act on money/invoicing widgets */
  canSeeMoney: boolean;
  /** Can run AI / Copilot / Agent / proactive tools that cost the owner */
  canUseAI: boolean;
  /** Can edit project settings, invite people, change billing */
  canManage: boolean;
  /** Can upload to Vault, drop files, comment, chat, edit Pad */
  canContribute: boolean;
}

/**
 * Returns the current user's role on a project + a permission map.
 * - Owner: full
 * - Creative / Collaborator: full participant minus Settings/Billing
 * - Client: comment + chat + approve drops + view Brief/Pad/Moodboard. NO money.
 * - Guest (token-based, no auth): contributor-light. Same as client but stricter.
 */
export function useStudioRole(
  project: any,
  currentUserId: string | null | undefined,
  collaborators: Array<{ id: string; role?: string | null }>,
): StudioPermissions {
  return useMemo(() => {
    const isOwner = !!project?.created_by && project.created_by === currentUserId;
    if (isOwner) {
      return {
        role: "owner",
        isOwner: true,
        canSeeMoney: true,
        canUseAI: true,
        canManage: true,
        canContribute: true,
      };
    }
    const me = collaborators.find((c) => c.id === currentUserId);
    const raw = (me?.role || "").toLowerCase();
    let role: StudioRole = "collaborator";
    if (raw === "client") role = "client";
    else if (raw === "creative") role = "creative";
    else if (raw === "guest") role = "guest";

    // Guests are read-mostly: chat/comment only — they cannot upload to Vault,
    // edit Pad, or change project state. Clients can contribute (approvals,
    // comments). Only creatives/collaborators get full contribute + AI.
    const canContribute = role === "creative" || role === "collaborator" || role === "client";
    const canSeeMoney = false; // never expose money to non-owners
    const canUseAI = role === "creative" || role === "collaborator";
    const canManage = false;

    return { role, isOwner: false, canSeeMoney, canUseAI, canManage, canContribute };
  }, [project?.created_by, currentUserId, collaborators]);
}
