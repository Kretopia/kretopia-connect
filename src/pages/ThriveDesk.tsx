import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, Menu, X, PanelRightOpen, PanelLeftClose, PanelLeftOpen, FolderKanban } from "lucide-react";
import { ProjectSettingsMenu } from "@/components/project/ProjectSettingsMenu";
import { SimpleProjectHeader } from "@/components/project/SimpleProjectHeader";
import { WorkspaceSidebar } from "@/components/project/WorkspaceSidebar";
import { WorkspaceQuickPanel } from "@/components/project/WorkspaceQuickPanel";
import { StudioToolBar } from "@/components/project/StudioToolBar";
import { ConfirmCreditBanner } from "@/components/project/ConfirmCreditBanner";
import { AgentModeBanner } from "@/components/project/AgentModeBanner";
import { ProjectInviteAcceptBanner } from "@/components/project/ProjectInviteAcceptBanner";
import { StudioCreatedAcknowledgement } from "@/components/project/studio/StudioCreatedAcknowledgement";
import { DeskTabContent } from "@/components/project/DeskTabContent";
import { useAgentRole } from "@/hooks/useAgentRole";

import { MobileProjectHub } from "@/components/project/mobile/MobileProjectHub";
import { StudioRoom } from "@/components/project/studio/StudioRoom";
import { StudioPhaseRail } from "@/components/project/studio/StudioPhaseRail";
import { ProjectCompleteDialog } from "@/components/project/studio/ProjectCompleteDialog";
import { DeskCommandPalette } from "@/components/desk/DeskCommandPalette";
import { VoiceCommandSheet } from "@/components/desk/VoiceCommandSheet";
import { ArrowLeft } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import { useProjectFlow, PROJECT_FLOW_STAGES, STUDIO_PHASES, stageToPhase, type ProjectFlowStageId } from "@/hooks/useProjectFlow";
import { useProjectFlowExtras } from "@/hooks/useProjectFlowExtras";
import { notifyPhaseAdvanced } from "@/lib/notifyPhaseAdvanced";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ThriveDesk = () => {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading, project, collaborators, files, messages, tasks, milestones,
    projects, userRole, isPro, user, fetchProjectData, fetchProjects,
  } = useProjectData(projectId);

  const [activeTab, setActiveTab] = useState("today");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("thrivedesk:sidebar-open") !== "false";
  });
  useEffect(() => {
    localStorage.setItem("thrivedesk:sidebar-open", String(desktopSidebarOpen));
  }, [desktopSidebarOpen]);
  const [quickPanelOpen, setQuickPanelOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [voiceCmdOpen, setVoiceCmdOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  // Studio Room is the default for "today" tab on BOTH mobile and desktop now
  const isStudioRoom = activeTab === "today";

  const agentRole = useAgentRole(project, user?.id || "");

  const flowExtras = useProjectFlowExtras(projectId, project?.updated_at);
  const flow = useProjectFlow({
    messageCount: messages.length,
    noteCount: flowExtras.noteCount,
    taskCount: tasks.length,
    taskDoneCount: tasks.filter((t) => t.status === "done").length,
    fileCount: files.length,
    approvalApprovedCount: flowExtras.approvalApprovedCount,
    approvalPendingCount: flowExtras.approvalPendingCount,
    contractCount: flowExtras.contractCount,
    contractSignedCount: flowExtras.contractSignedCount,
    invoiceCount: flowExtras.invoiceCount,
    invoicePaidCount: flowExtras.invoicePaidCount,
    milestoneCount: milestones.length,
    projectStatus: project?.status,
    pinnedStage: project?.pinned_stage,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setActiveTab(detail);
    };
    window.addEventListener("thrivedesk:set-tab", handler);
    return () => window.removeEventListener("thrivedesk:set-tab", handler);
  }, []);

  useEffect(() => {
    if (!project || searchParams.get("section") !== "sponsors") return;
    setActiveTab("today");
    window.dispatchEvent(new CustomEvent("thrivedesk:set-tab", { detail: "today" }));
    window.setTimeout(() => {
      document.getElementById("studio-sponsors")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }, [project, searchParams]);

  // Returning from a Stripe Checkout redirect (create-milestone-payment's
  // success_url/cancel_url). The milestone itself updates via the realtime
  // subscription in useProjectData once the webhook lands -- this is just
  // giving the user immediate, honest feedback instead of silently dropping
  // them back on the page with an ignored ?payment= param.
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (!paymentStatus) return;

    if (paymentStatus === "success") {
      toast.success("Payment received", {
        description: "Confirming with Stripe — the milestone will update automatically in a moment.",
      });
      setActiveTab("finance");
    } else if (paymentStatus === "cancelled") {
      toast("Payment cancelled", { description: "No charge was made." });
    }

    const next = new URLSearchParams(searchParams);
    next.delete("payment");
    next.delete("milestone");
    next.delete("escrow");
    setSearchParams(next, { replace: true });
    // Intentionally run once on mount -- this reads the redirect params from
    // Stripe, not something that should re-fire as searchParams change later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broadcast tab changes so global UI (e.g. Copilot FAB) can react.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("thrivedesk:tab-changed", { detail: activeTab }),
    );
  }, [activeTab]);

  // Navigate to a tab and optionally broadcast an "intent" so the target tab
  // can pre-fill (e.g. open create dialog). Listeners are added in target components.
  const goToTabWithIntent = (tab: string, intent?: string) => {
    setActiveTab(tab);
    if (intent) {
      // Defer so the tab mounts first
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("thrivedesk:intent", { detail: { tab, intent } }));
      }, 50);
    }
  };

  const handlePinStage = async (stageId: ProjectFlowStageId | null) => {
    if (!projectId) return;
    const { error } = await supabase
      .from("projects")
      .update({ pinned_stage: stageId })
      .eq("id", projectId);
    if (error) {
      toast.error("Couldn't update stage");
      return;
    }
    toast.success(stageId ? "Stage pinned" : "Stage unpinned");
    fetchProjectData();
  };

  // Explicit step validation — advancing the phase rail is a deliberate
  // click, not just derived from activity. Reuses the existing
  // pinned_stage override (handlePinStage) so "validate" and "pin" are the
  // same underlying mechanism instead of two competing ones. Lives here
  // (not in StudioRoom) so the rail — and this handler — stay available
  // on every tab, not just "today". Also navigates straight into the
  // newly-unlocked phase's tab, instead of just relabeling the marker and
  // leaving the person wherever they already were.
  const handleValidateStep = () => {
    const currentIdx = PROJECT_FLOW_STAGES.findIndex((s) => s.id === flow.currentStageId);
    if (currentIdx < 0 || currentIdx >= PROJECT_FLOW_STAGES.length - 1) return;
    // Advance to the first stage that belongs to a *different* phase, so the
    // phase rail actually moves (Build = tasks+work, Wrap = review+agreement+payment).
    const currentPhase = stageToPhase(flow.currentStageId);
    const nextStage =
      PROJECT_FLOW_STAGES.slice(currentIdx + 1).find((s) => stageToPhase(s.id) !== currentPhase) ??
      PROJECT_FLOW_STAGES[currentIdx + 1];
    const nextPhaseLabel = STUDIO_PHASES.find((p) => p.id === stageToPhase(nextStage.id))?.label ?? nextStage.label;

    handlePinStage(nextStage.id);
    toast.success(`${nextPhaseLabel} unlocked`, { description: `${project?.title} moved into ${nextPhaseLabel}.` });
    goToTabWithIntent(nextStage.tab);

    notifyPhaseAdvanced({
      projectId: projectId!,
      projectTitle: project?.title ?? "",
      phaseLabel: nextPhaseLabel,
      collaboratorIds: collaborators.map((c: any) => c.id),
      actorId: user?.id || "",
    }).catch(() => { /* non-blocking */ });

    if (nextStage.id === "complete") setCompleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Header skeleton */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-2">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-7 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted/70 animate-pulse" />
        </div>
        {/* Tab strip skeleton */}
        <div className="px-4 py-3 flex gap-2 overflow-hidden border-b border-border/30">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 rounded-full bg-muted animate-pulse shrink-0"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
        {/* Body skeleton */}
        <div className="px-4 py-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold mb-1">Studio not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This studio may have been removed or you don't have access.
          </p>
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row overflow-hidden bg-background h-[calc(100dvh-4rem)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] touch-pan-y lg:h-[100dvh] lg:pb-0">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left Sidebar - Project List */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-all duration-200 lg:relative",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
        desktopSidebarOpen ? "lg:w-64" : "lg:w-0 lg:border-r-0 lg:overflow-hidden"
      )}>
        <WorkspaceSidebar
          projects={projects}
          activeProjectId={projectId}
          onClose={() => setSidebarOpen(false)}
          onProjectCreated={fetchProjects}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Workspace Header */}
        <header className="h-14 border-b-2 border-primary/20 bg-card flex items-center gap-3 px-4 shrink-0 shadow-sm">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex shrink-0"
            onClick={() => setDesktopSidebarOpen((v) => !v)}
            aria-label={desktopSidebarOpen ? "Hide studios" : "Show studios"}
            title={desktopSidebarOpen ? "Hide studios" : "Show studios"}
          >
            {desktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          <SimpleProjectHeader
            project={project}
            collaborators={collaborators}
            onCollaboratorsChanged={fetchProjectData}
            compact
          />
          <ProjectSettingsMenu
            project={project}
            collaborators={collaborators}
            currentUserId={user?.id || ""}
            isPro={isPro}
            onProjectUpdated={fetchProjectData}
            onNavigateToTab={setActiveTab}
          />
        </header>

        {/* Phase rail — a real header row (not a sticky trick over a
            scrolling child), so it's genuinely always visible: same
            instance across every tab, including rolling back to an
            earlier one, instead of only existing on the "today" tab and
            vanishing the moment its own markers navigate you elsewhere. */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border/60 shrink-0">
          <StudioPhaseRail
            flow={flow}
            onPhaseClick={goToTabWithIntent}
            onPinStage={handlePinStage}
            onValidateStep={handleValidateStep}
          />
        </div>

        {/* Unified tool bar — same on mobile and desktop when drilled into a tool */}
        {!isStudioRoom && (
          <StudioToolBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            workspaceType={project?.workspace_type ?? "general"}
            dealType={project?.deal_type ?? "paid"}
            taskCount={tasks.filter(t => t.status !== 'done').length}
            messageCount={messages.length}
          />
        )}

        {/* Kreto's one-time "Studio is ready" acknowledgement — only when
            New Room's real navigate() call included the confirmation flag
            (KRETO_NEW_ROOM_INTEGRATION_REPORT.md); a no-op on every other
            visit to this route, including a refresh of this same one. */}
        <StudioCreatedAcknowledgement />

        {/* Agent Mode Banner — visible when agent_mode is true */}
        <AgentModeBanner agentRole={agentRole} />

        {/* Pending invite — accept inline */}
        <ProjectInviteAcceptBanner projectId={projectId!} onAccepted={fetchProjectData} />

        {/* Credit Confirmation Banner — only when project opted-in to credits */}
        {(project as any)?.track_as_credit && (
          <ConfirmCreditBanner
            projectId={projectId!}
            projectTitle={project.title}
            onConfirmed={fetchProjectData}
          />
        )}

        {/* Content + Quick Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {isStudioRoom ? (
            <StudioRoom
              project={project}
              tasks={tasks}
              files={files}
              collaborators={collaborators as any}
              currentUserId={user?.id || ""}
              onUpdated={fetchProjectData}
              onNavigateToTab={goToTabWithIntent}
              flow={flow}
            />
          ) : (
            <DeskTabContent
              activeTab={activeTab}
              projectId={projectId!}
              project={project}
              messages={messages}
              tasks={tasks}
              files={files}
              milestones={milestones}
              collaborators={collaborators}
              currentUserId={user?.id || ""}
              userRole={userRole}
              isPro={isPro}
              agentRole={agentRole}
              onUpdate={fetchProjectData}
            />
          )}

          {/* Quick Panel Toggle - Desktop only, hidden in Studio */}
          {!isStudioRoom && !quickPanelOpen && (
            <div className="hidden xl:flex items-start pt-3 pr-2 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuickPanelOpen(true)}>
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right Quick Panel - Desktop only, hidden in Studio */}
          {!isStudioRoom && quickPanelOpen && (
            <div className="hidden xl:block w-80 border-l border-border bg-card/30 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Panel</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuickPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <WorkspaceQuickPanel
                tasks={tasks}
                files={files}
                collaborators={collaborators}
                projectId={projectId!}
                onTasksChanged={fetchProjectData}
                currentUserId={user?.id || ""}
                onNavigateToTab={setActiveTab}
              />
            </div>
          )}
        </div>
      </div>

      {/* Kreto is mounted globally via ThriveAgentFab — no per-page launcher needed. */}

      {/* Global ⌘K palette + voice command — available across the workspace */}
      <DeskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onVoiceCommand={() => setVoiceCmdOpen(true)}
      />
      <VoiceCommandSheet open={voiceCmdOpen} onOpenChange={setVoiceCmdOpen} />
      <ProjectCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        projectTitle={project.title}
      />
    </div>
  );
};

export default ThriveDesk;
