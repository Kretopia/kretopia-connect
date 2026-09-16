// Derives the current viewer's perspective inside an agent-brokered project.
// Used to filter sensitive money fields (margin, payouts) so each party only
// sees what they should.

export type AgentViewRole = "manager" | "client" | "creative" | "observer";

export interface AgentRoleInfo {
  /** True only when the project is in agent_mode. */
  isAgentMode: boolean;
  /** The viewer's role within this brokered deal. */
  role: AgentViewRole;
  /** Convenience flags. */
  isManager: boolean;
  isClient: boolean;
  isCreative: boolean;
  /** Whether this viewer can see the full financial picture (price + payout + margin). */
  canSeeMargin: boolean;
  /** Whether this viewer can see the client-facing price. */
  canSeeClientPrice: boolean;
  /** Whether this viewer can see the creative's payout. */
  canSeeCreativePayout: boolean;
}

export function useAgentRole(project: any | null | undefined, currentUserId: string): AgentRoleInfo {
  const isAgentMode = !!project?.agent_mode;

  let role: AgentViewRole = "observer";
  if (project && currentUserId) {
    const agentId = project.agent_user_id ?? project.created_by;
    const clientId = project.client_user_id;
    const creativeIds: string[] = Array.isArray(project.creative_user_ids) ? project.creative_user_ids : [];

    if (currentUserId === agentId) role = "manager";
    else if (currentUserId === clientId) role = "client";
    else if (creativeIds.includes(currentUserId)) role = "creative";
  }

  // When NOT in agent mode, everyone sees everything (regular project rules apply).
  if (!isAgentMode) {
    return {
      isAgentMode: false,
      role,
      isManager: role === "manager",
      isClient: role === "client",
      isCreative: role === "creative",
      canSeeMargin: true,
      canSeeClientPrice: true,
      canSeeCreativePayout: true,
    };
  }

  return {
    isAgentMode: true,
    role,
    isManager: role === "manager",
    isClient: role === "client",
    isCreative: role === "creative",
    canSeeMargin: role === "manager",
    canSeeClientPrice: role === "manager" || role === "client",
    canSeeCreativePayout: role === "manager" || role === "creative",
  };
}
