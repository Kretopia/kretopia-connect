import { memo } from "react";
import { TodayWorkspace } from "@/components/project/today/TodayWorkspace";
import { FileBrowser } from "@/components/project/files/FileBrowser";
import { VaultTab } from "@/components/project/studio/VaultTab";
import { WorkflowShell } from "@/components/project/studio/WorkflowShell";
import { StickyNote, Clapperboard, ListChecks, UserCheck, Music2, History } from "lucide-react";
import { TasksWorkspace } from "@/components/project/tasks/TasksWorkspace";
import { SimpleProjectChat } from "@/components/project/SimpleProjectChat";
import { FinanceHub } from "@/components/project/finance/FinanceHub";
import { AgentFinanceSummary } from "@/components/project/finance/AgentFinanceSummary";
import { CorkBoard } from "@/components/project/CorkBoard";
import { AIBriefBuilder } from "@/components/project/AIBriefBuilder";
import { AIAutomation } from "@/components/project/AIAutomation";
import { ApprovalWorkflows } from "@/components/project/ApprovalWorkflows";
import { CreativeAssetLibrary } from "@/components/project/CreativeAssetLibrary";
import { StudioAICreate } from "@/components/project/studio/StudioAICreate";
import { ProjectTemplatePicker } from "@/components/project/ProjectTemplatePicker";
import { CreativeBoard } from "@/components/project/CreativeBoard";
import { ScopeGuardian } from "@/components/project/ScopeGuardian";
import { ContractsList } from "@/components/project/contracts/ContractsList";
import { CallSheetTab } from "@/components/project/workflow/CallSheetTab";
import { RunOfShowTab } from "@/components/project/workflow/RunOfShowTab";
import { RollCallTab } from "@/components/project/workflow/RollCallTab";
import { SplitSheetTab } from "@/components/project/workflow/SplitSheetTab";
import { ExchangeLedgerTab } from "@/components/project/workflow/ExchangeLedgerTab";
import { RevisionsTab } from "@/components/project/workflow/RevisionsTab";
import { BriefHub } from "@/components/project/BriefHub";
import { DeliverablesBoard } from "@/components/project/DeliverablesBoard";
import { UsageLimitBanner } from "@/components/project/ProGate";
import { FreeTierGate } from "@/components/FreeTierGate";
import { cn } from "@/lib/utils";
import type { Collaborator } from "@/hooks/useProjectData";
import type { AgentRoleInfo } from "@/hooks/useAgentRole";

const FREE_LIMITS = { files: 10, tasks: 20, boardItems: 15 };

interface DeskTabContentProps {
  activeTab: string;
  projectId: string;
  project: any;
  messages: any[];
  tasks: any[];
  files: any[];
  milestones: any[];
  collaborators: Collaborator[];
  currentUserId: string;
  userRole: "creator" | "client";
  isPro: boolean;
  agentRole?: AgentRoleInfo;
  onUpdate: () => void;
}

export const DeskTabContent = memo(({
  activeTab,
  projectId,
  project,
  messages,
  tasks,
  files,
  milestones,
  collaborators,
  currentUserId,
  userRole,
  isPro,
  agentRole,
  onUpdate,
}: DeskTabContentProps) => {
  const setTab = (tab: string) => {
    // dispatch via custom event so parent can pick it up without prop drilling
    window.dispatchEvent(new CustomEvent("thrivedesk:set-tab", { detail: tab }));
  };
  return (
  <div className={cn("flex-1 min-h-0 min-w-0", activeTab === "messages" || activeTab === "today" ? "flex flex-col" : "overflow-y-auto")}>
    {activeTab === "today" && (
      <TodayWorkspace
        projectId={projectId}
        isPro={isPro}
        tasks={tasks}
        messages={messages}
        files={files}
        milestones={milestones}
        collaborators={collaborators}
        currentUserId={currentUserId}
        onUpdate={onUpdate}
        onNavigateToTab={setTab}
      />
    )}

    {activeTab === "messages" && (
      <SimpleProjectChat
        projectId={projectId}
        messages={messages}
        currentUserId={currentUserId}
        onMessageSent={onUpdate}
        collaborators={collaborators}
      />
    )}

    {activeTab !== "messages" && activeTab !== "today" && (
      <div className="p-4 md:p-6 pb-24 md:pb-6">
        {activeTab === "tasks" && (
          <>
            <UsageLimitBanner current={tasks.length} limit={FREE_LIMITS.tasks} itemName="tasks" isPro={isPro} />
            <TasksWorkspace
              projectId={projectId}
              tasks={tasks}
              onUpdate={onUpdate}
              collaborators={collaborators}
              currentUserId={currentUserId}
            />
          </>
        )}

        {activeTab === "files" && (
          <>
            <UsageLimitBanner current={files.length} limit={FREE_LIMITS.files} itemName="files" isPro={isPro} />
            <FileBrowser projectId={projectId} files={files} onFileUploaded={onUpdate} />
          </>
        )}

        {activeTab === "vault" && (
          <>
            <UsageLimitBanner current={files.length} limit={FREE_LIMITS.files} itemName="files" isPro={isPro} />
            <VaultTab
              projectId={projectId}
              projectTitle={project.title}
              files={files}
              currentUserId={currentUserId}
              onFileUploaded={onUpdate}
              onJumpToBrief={() => setTab("brief")}
            />
          </>
        )}

        {activeTab === "brief" && (
          <div className="space-y-4">
            <BriefHub projectId={projectId} projectTitle={project.title} onCreated={onUpdate} />
            <DeliverablesBoard projectId={projectId} projectTitle={project.title} currentUserId={currentUserId} />
          </div>
        )}

        {activeTab === "approvals" && (
          <FreeTierGate feature="approvalRequests" featureLabel="Approval Workflows" description="Upgrade to Pro for unlimited approval workflows, visual feedback, and status tracking.">
            <ApprovalWorkflows projectId={projectId} currentUserId={currentUserId} collaborators={collaborators} userRole={userRole} />
          </FreeTierGate>
        )}

        {activeTab === "assets" && (
          <CreativeAssetLibrary projectId={projectId} currentUserId={currentUserId} />
        )}

        {activeTab === "board" && (
          <CreativeBoard projectId={projectId} currentUserId={currentUserId} />
        )}

        {activeTab === "ai" && (
          <StudioAICreate projectId={projectId} currentUserId={currentUserId} isPro={isPro} />
        )}

        {activeTab === "contracts" && (
          <ContractsList projectId={projectId} currentUserId={currentUserId} collaborators={collaborators} />
        )}

        {activeTab === "scope" && (
          <ScopeGuardian
            projectId={projectId}
            project={project}
            milestones={milestones}
            onMilestonesGenerated={onUpdate}
          />
        )}

        {activeTab === "finance" && (
          <FreeTierGate feature="milestones" featureLabel="Finance Tools" description="Upgrade to Pro for unlimited milestones, invoices, and project payments.">
            {agentRole?.isAgentMode && (
              <AgentFinanceSummary project={project} agentRole={agentRole} />
            )}
            <FinanceHub
              projectId={projectId}
              project={project}
              milestones={milestones}
              collaborators={collaborators}
              currentUserId={currentUserId}
              userRole={userRole}
              onUpdate={onUpdate}
            />
          </FreeTierGate>
        )}

        {activeTab === "notes" && (
          <WorkflowShell
            eyebrow="The Pad"
            title="Cork Board"
            subtitle="Pin sticky notes, drop references, spark ideas. Drag anything anywhere."
            icon={StickyNote}
          >
            <CorkBoard projectId={projectId} currentUserId={currentUserId} />
          </WorkflowShell>
        )}

        {activeTab === "call_sheet" && (
          <WorkflowShell
            eyebrow="Production"
            title="Call Sheet"
            subtitle="Date, location, contacts, weather — everything for shoot day."
            icon={Clapperboard}
          >
            <CallSheetTab projectId={projectId} currentUserId={currentUserId} />
          </WorkflowShell>
        )}
        {activeTab === "run_of_show" && (
          <WorkflowShell
            eyebrow="Event"
            title="Run of Show"
            subtitle="Minute-by-minute timeline of segments, sets, and scenes."
            icon={ListChecks}
          >
            <RunOfShowTab projectId={projectId} currentUserId={currentUserId} />
          </WorkflowShell>
        )}
        {activeTab === "roll_call" && (
          <WorkflowShell
            eyebrow="On the Day"
            title="Roll Call"
            subtitle="Who's confirmed, who's on the way, who's in the room."
            icon={UserCheck}
          >
            <RollCallTab projectId={projectId} collaborators={collaborators} currentUserId={currentUserId} />
          </WorkflowShell>
        )}
        {activeTab === "split_sheet" && (
          <WorkflowShell
            eyebrow="Music"
            title="Split Sheet"
            subtitle="Songwriter splits & contribution percentages."
            icon={Music2}
          >
            <SplitSheetTab projectId={projectId} collaborators={collaborators} currentUserId={currentUserId} />
          </WorkflowShell>
        )}
        {activeTab === "exchange" && (
          <ExchangeLedgerTab projectId={projectId} currentUserId={currentUserId} />
        )}
        {activeTab === "revisions" && (
          <WorkflowShell
            eyebrow="Iteration"
            title="Revisions"
            subtitle="Track every round of edits, mixes, and notes."
            icon={History}
          >
            <RevisionsTab projectId={projectId} currentUserId={currentUserId} />
          </WorkflowShell>
        )}
      </div>
    )}
  </div>
  );
});

DeskTabContent.displayName = "DeskTabContent";
