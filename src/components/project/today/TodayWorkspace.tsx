import { TodayTasksPanel } from "./TodayTasksPanel";
import { TodayActivityFeed } from "./TodayActivityFeed";
import type { Collaborator } from "@/hooks/useProjectData";

interface TodayWorkspaceProps {
  projectId: string;
  isPro: boolean;
  tasks: any[];
  messages: any[];
  files: any[];
  milestones: any[];
  collaborators: Collaborator[];
  currentUserId: string;
  onUpdate: () => void;
  onNavigateToTab: (tab: string) => void;
}

export const TodayWorkspace = ({
  projectId,
  tasks,
  messages,
  files,
  milestones,
  collaborators,
  currentUserId,
  onUpdate,
  onNavigateToTab,
}: TodayWorkspaceProps) => (
  <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 overflow-y-auto lg:overflow-hidden">
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden lg:min-h-0">
      <TodayTasksPanel
        projectId={projectId}
        tasks={tasks}
        collaborators={collaborators}
        currentUserId={currentUserId}
        onUpdate={onUpdate}
        onSeeAll={() => onNavigateToTab("tasks")}
      />
    </div>

    <div className="rounded-xl border border-border bg-card/40 overflow-hidden lg:min-h-0">
      <TodayActivityFeed
        messages={messages}
        files={files}
        tasks={tasks}
        milestones={milestones}
        collaborators={collaborators}
        currentUserId={currentUserId}
        onOpenChat={() => onNavigateToTab("messages")}
      />
    </div>
  </div>
);

