import { AgentApprovalCard } from "./AgentApprovalCard";
import { usePendingAgentActions } from "@/hooks/usePendingAgentActions";

interface Props {
  /** Cap how many cards render. Default 3. */
  limit?: number;
  emptyState?: React.ReactNode;
}

/**
 * Drop this anywhere (Home, Desk, Pay) to surface the user's pending agent approvals.
 * Self-fetches and listens to realtime updates.
 */
export const AgentApprovalsTray = ({ limit = 3, emptyState }: Props) => {
  const { actions, loading, remove } = usePendingAgentActions();

  if (loading) return null;
  if (!actions.length) return emptyState ? <>{emptyState}</> : null;

  return (
    <div className="space-y-2">
      {actions.slice(0, limit).map((action) => (
        <AgentApprovalCard
          key={action.id}
          action={action}
          onResolved={() => remove(action.id)}
          compact
        />
      ))}
    </div>
  );
};
