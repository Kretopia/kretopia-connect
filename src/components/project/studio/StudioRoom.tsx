import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { VibeHeader } from "./VibeHeader";
// StudioPulseFeed retired — merged into BriefDropZone (one true Drop Zone).
import { NextStepCard } from "./NextStepCard";
import { SendInvoiceNudge } from "./SendInvoiceNudge";
import { FirstTimeHint } from "@/components/ui/first-time-hint";
import { ProactiveCards } from "./ProactiveCards";
import { AutopilotProjectGuide } from "./AutopilotProjectGuide";
import { BriefSection } from "./BriefSection";
import { BriefDropZone } from "./BriefDropZone";
import { ImportedSourcesCard } from "./ImportedSourcesCard";
import { WorkSection } from "./WorkSection";
import { MoneySection } from "./MoneySection";
import { PeopleSection } from "./PeopleSection";
import { AddCreditSection } from "./AddCreditSection";
import { WrapProjectCard } from "./WrapProjectCard";
import { CallHistorySection } from "./CallHistorySection";
import { MilestoneStrip } from "./MilestoneStrip";
import { PadPreviewSection } from "./PadPreviewSection";
// ThriveGenerateCard retired — folded into StudioOutcomeComposer.
import { StudioOutcomeComposer } from "./StudioOutcomeComposer";
import { BrandVaultChip } from "@/components/brand-vault/BrandVaultChip";
import { StudioBrainPanel } from "./StudioBrainPanel";

import { DeliverablesSection } from "./DeliverablesSection";
import { ProductionPrepSection } from "./ProductionPrepSection";
import { PodcastStudioSection } from "./PodcastStudioSection";
import { ContentStudioSection } from "./ContentStudioSection";
import { CampaignStudioSection } from "./CampaignStudioSection";
import { MusicStudioSection } from "./MusicStudioSection";
import { ModelingStudioSection } from "./ModelingStudioSection";
import { EventStudioSection } from "./EventStudioSection";
import { EventHeroCard } from "./EventHeroCard";
import { EventCrmSection } from "./EventCrmSection";
import { EventSponsorsKanban } from "./EventSponsorsKanban";
import { EventRsvpQuestionsBuilder } from "./EventRsvpQuestionsBuilder";
import { EventGuestMatchesSection } from "./EventGuestMatchesSection";
import { EventSeatingPlanner } from "./EventSeatingPlanner";
import { EventOutreachSegmentBuilder } from "./EventOutreachSegmentBuilder";
import { EventPostRecapSection } from "./EventPostRecapSection";
import { EventProducerDashboard } from "./EventProducerDashboard";
import { RequestPaymentCard } from "./RequestPaymentCard";
import { SortableSection } from "./SortableSection";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { HideableSection, SectionsBringBackTray } from "./HideableSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStudioPresence } from "@/hooks/useStudioPresence";
import { useProjectMoneySignal } from "@/hooks/useProjectMoneySignal";
import { useStudioRole } from "@/hooks/useStudioRole";
import { useDeskAgentWatch } from "@/hooks/useDeskAgentWatch";
import { type ProjectFlow } from "@/hooks/useProjectFlow";

interface StudioRoomProps {
  project: any;
  tasks: any[];
  files: any[];
  collaborators: Array<{
    id: string;
    full_name: string;
    avatar_url?: string | null;
    role?: string | null;
  }>;
  currentUserId: string;
  onUpdated: () => void;
  onNavigateToTab: (tab: string, intent?: string) => void;
  flow: ProjectFlow;
}

/**
 * Studio Room — single scrolling, warm view of a project. Mobile-first.
 * Composes: VibeHeader → BriefSection → WorkSection → MoneySection →
 * PeopleSection → AddCreditSection.
 */
export const StudioRoom = ({
  project,
  tasks,
  files,
  collaborators,
  currentUserId,
  onUpdated,
  onNavigateToTab,
  flow,
}: StudioRoomProps) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const moneySignal = useProjectMoneySignal(project);

  const isOwner = project?.created_by === currentUserId;

  // Phase 7: Thrive watches chat + state and proposes proactive next moves (owner only)
  useDeskAgentWatch(isOwner ? project?.id : null);

  // Normalize collaborator shape (id is profile id; full_name from join in useProjectData)
  const people = collaborators.map((c: any) => ({
    id: c.id,
    full_name: c.full_name || c.profiles?.full_name || "Member",
    avatar_url: c.avatar_url ?? c.profiles?.avatar_url ?? null,
    role: c.role ?? null,
  }));

  // Role-based permissions
  const perms = useStudioRole(project, currentUserId, people);
  const isClient = perms.role === "client";
  const isCollaborator = perms.role === "collaborator" || perms.role === "creative";
  // Owner sees money normally; client sees a read-only "amount due / pay" view; collaborators don't see money.
  const showMoney = (perms.canSeeMoney && moneySignal.visible) || isClient;
  const showAITools = perms.canUseAI;
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const showPrep = perms.isOwner; // Run-of-show / call sheets stay internal until shared

  // Identify current user from the people list for presence metadata
  const me = useMemo(
    () => people.find((p) => p.id === currentUserId) ?? null,
    [people, currentUserId],
  );
  const { onlineUserIds, knock } = useStudioPresence(
    project?.id,
    me ? { id: me.id, full_name: me.full_name, avatar_url: me.avatar_url } : null,
  );

  const handleAddReference = () => {
    if (!isOwner) {
      toast({ title: "Only the owner can add references" });
      return;
    }
    fileRef.current?.click();
  };

  const handleReferencePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    try {
      for (const file of picked) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${project.id}/moodboard-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        await supabase.from("project_files").insert({
          project_id: project.id,
          user_id: currentUserId,
          file_name: file.name,
          file_url: path, // store relative path; render via signed URL
          file_type: file.type,
          file_size: file.size,
        });
      }
      toast({ title: picked.length > 1 ? "References added" : "Reference added" });
      onUpdated();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isQuota = /quota exceeded/i.test(msg) || /storage.*full/i.test(msg);
      toast({
        title: isQuota ? "Storage full" : "Couldn't add reference",
        description: isQuota
          ? "Free up space in your Vault or upgrade your plan to add more references."
          : msg,
        variant: "destructive",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ===== Reusable section blocks (mobile keeps original order) =====
  const RoomChatButton = (
    <button
      type="button"
      onClick={() => onNavigateToTab("messages")}
      className="mx-4 mb-3 mt-1 flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-3 text-left lg:mx-0 lg:w-full"
    >
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <span aria-hidden className="text-base">💬</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Room chat</p>
        <p className="text-[11px] text-muted-foreground leading-tight">
          Talk to everyone here · @mentions, files & voice
        </p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Open</span>
    </button>
  );

  const isEvent = ["event", "event_production"].includes(project.workspace_type);

  // Labels used by the "Hidden sections" tray so users can re-show what they
  // dismissed. Only event sub-sections are hideable for now.
  const EVENT_HIDEABLE_LABELS: Record<string, string> = {
    "event-hero": "Event details",
    "event-producer": "Producer dashboard",
    "event-studio": "Run of show",
    "event-suppliers": "Suppliers",
    "event-talent": "Talent",
    "event-sponsors": "Sponsors",
    "event-rsvp": "RSVP questions",
    "event-matches": "Guest matches",
    "event-seating": "Seating planner",
    "event-outreach": "Outreach segments",
    "event-recap": "Post-event recap",
  };

  // Studio Brain entry point — lives at the very top of the room so every
  // drop (file/link/voice) goes through the unified `studio-ingest` router.
  const dropZone = (
    <>
      <BriefDropZone
        projectId={project.id}
        projectTitle={project.title ?? "this project"}
        isOwner={isOwner}
        onIngested={onUpdated}
      />
      <div className="px-4 pt-2">
        <ImportedSourcesCard projectId={project.id} />
      </div>
      {/* Phase E — outcome composer: free-text → routed capability */}
      {isOwner && (
        <StudioOutcomeComposer projectId={project.id} projectTitle={project.title ?? "this project"} />
      )}
      {/* Brand + Brain — what Thrive knows and how it'll style every output */}
      {isOwner && (
        <div className="px-4 pt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground w-full sm:w-auto">Thrive uses</span>
          <BrandVaultChip projectId={project.id} />
          <StudioBrainPanel projectId={project.id} isOwner={isOwner} />
        </div>
      )}
    </>
  );


  const briefBlock = (
    <BriefSection project={project} files={files} isOwner={isOwner} onUpdated={onUpdated} onAddReference={handleAddReference} currentUserId={currentUserId} />
  );

  const mobileWorkColumn = (includeBrief: boolean) => (
    <div className="divide-y divide-border/60">
      {includeBrief && briefBlock}
      {/* Pulse merged into the single Drop Zone at the top of the room. */}
      <DeliverablesSection projectId={project.id} currentUserId={currentUserId} isOwner={isOwner} />
      {/* ThriveGenerateCard retired — folded into StudioOutcomeComposer at top of room. */}
      <PadPreviewSection projectId={project.id} onOpen={() => onNavigateToTab("notes")} />
      {showPrep && (
        <ProductionPrepSection project={project} tasks={tasks} currentUserId={currentUserId} onOpenTool={(tab) => onNavigateToTab(tab)} onUpdated={onUpdated} />
      )}
      <WorkSection tasks={tasks} projectId={project.id} currentUserId={currentUserId} collaborators={people} onUpdated={onUpdated} />
    </div>
  );

  // Condensed by default — end-of-project widgets nobody needs on every
  // visit are collapsed behind a one-line summary instead of always
  // pushing the page length out. Native <details> so no extra state.
  // Shared by mobile (flat divide-y list) and desktop (card widgets).
  const collapsedWidget = (label: string, node: React.ReactNode, flat = false) => (
    <details className={cn("group", flat ? "" : "rounded-2xl border border-border/60 bg-card/40 overflow-hidden")}>
      <summary className={cn("cursor-pointer list-none flex items-center justify-between text-sm font-semibold", flat ? "px-4 py-3.5" : "px-4 py-3")}>
        {label}
        <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-border/60">{node}</div>
    </details>
  );

  const mobileSideColumn = (
    <div className="divide-y divide-border/60">
      {showMoney && (
        <MoneySection project={project} isOwner={isOwner} clientView={isClient} onOpenInvoice={() => onNavigateToTab("finance", "create-invoice")} />
      )}
      {showMoney && (
        <MilestoneStrip projectId={project.id} currency={project.currency} onOpenFinance={() => onNavigateToTab("finance")} />
      )}
      {isCollaborator && (
        <RequestPaymentCard project={project} currentUserId={currentUserId} />
      )}
      <PeopleSection collaborators={people} ownerUserId={project.created_by} currentUserId={currentUserId} isOwner={isOwner} projectId={project.id} onUpdated={onUpdated} onlineUserIds={onlineUserIds} onKnock={knock} />
      {collapsedWidget("Wrap the project", <WrapProjectCard project={project} tasks={tasks} collaborators={people} currentUserId={currentUserId} isOwner={isOwner} onUpdated={onUpdated} />, true)}
      {collapsedWidget("Add a credit", <AddCreditSection project={project} collaborators={people} />, true)}
      {collapsedWidget("Call history", <CallHistorySection projectId={project.id} />, true)}
    </div>
  );

  // ===== Desktop draggable widgets =====
  type WidgetId =
    | "brief" | "pulse" | "deliverables" | "pad" | "prep" | "work"
    | "money" | "milestones" | "request_pay" | "people" | "wrap" | "credit" | "calls";

  const renderWidget = (id: WidgetId): React.ReactNode => {
    const wrap = (node: React.ReactNode) => (
      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">{node}</div>
    );
    switch (id) {
      case "brief": return wrap(<BriefSection project={project} files={files} isOwner={isOwner} onUpdated={onUpdated} onAddReference={handleAddReference} currentUserId={currentUserId} />);
      case "pulse": return null; // retired — Drop Zone now lives above the layout
      case "deliverables": return wrap(<DeliverablesSection projectId={project.id} currentUserId={currentUserId} isOwner={isOwner} />);
      case "pad": return wrap(<PadPreviewSection projectId={project.id} onOpen={() => onNavigateToTab("notes")} />);
      case "prep": return showPrep ? wrap(<ProductionPrepSection project={project} tasks={tasks} currentUserId={currentUserId} onOpenTool={(tab) => onNavigateToTab(tab)} onUpdated={onUpdated} />) : null;
      case "work": return wrap(<WorkSection tasks={tasks} projectId={project.id} currentUserId={currentUserId} collaborators={people} onUpdated={onUpdated} />);
      case "money": return showMoney ? wrap(<MoneySection project={project} isOwner={isOwner} clientView={isClient} onOpenInvoice={() => onNavigateToTab("finance", "create-invoice")} />) : null;
      case "milestones": return showMoney ? wrap(<MilestoneStrip projectId={project.id} currency={project.currency} onOpenFinance={() => onNavigateToTab("finance")} />) : null;
      case "request_pay": return isCollaborator ? wrap(<RequestPaymentCard project={project} currentUserId={currentUserId} />) : null;
      case "people": return wrap(<PeopleSection collaborators={people} ownerUserId={project.created_by} currentUserId={currentUserId} isOwner={isOwner} projectId={project.id} onUpdated={onUpdated} onlineUserIds={onlineUserIds} onKnock={knock} />);
      case "wrap": return collapsedWidget("Wrap the project", <WrapProjectCard project={project} tasks={tasks} collaborators={people} currentUserId={currentUserId} isOwner={isOwner} onUpdated={onUpdated} />);
      case "credit": return collapsedWidget("Add a credit", <AddCreditSection project={project} collaborators={people} />);
      case "calls": return collapsedWidget("Call history", <CallHistorySection projectId={project.id} />);
    }
  };

  const DEFAULT_LEFT: WidgetId[] = ["brief", "deliverables", "pad", "prep", "work"];
  const DEFAULT_RIGHT: WidgetId[] = ["money", "milestones", "request_pay", "people", "wrap", "credit", "calls"];
  const STORAGE_KEY = `thrivedesk:widgets:${project.id}`;

  const [leftOrder, setLeftOrder] = useState<WidgetId[]>(DEFAULT_LEFT);
  const [rightOrder, setRightOrder] = useState<WidgetId[]>(DEFAULT_RIGHT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { left?: WidgetId[]; right?: WidgetId[] };
      const all = [...DEFAULT_LEFT, ...DEFAULT_RIGHT];
      const sanitize = (arr?: WidgetId[]) => (arr ?? []).filter((id) => all.includes(id));
      const merge = (saved: WidgetId[], def: WidgetId[]) => {
        const missing = def.filter((id) => !saved.includes(id) && !sanitize(parsed.left).includes(id) && !sanitize(parsed.right).includes(id));
        return [...saved, ...missing];
      };
      const savedLeft = sanitize(parsed.left);
      const savedRight = sanitize(parsed.right);
      setLeftOrder(merge(savedLeft, DEFAULT_LEFT));
      setRightOrder(merge(savedRight, DEFAULT_RIGHT));
    } catch {/* noop */}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const persist = (left: WidgetId[], right: WidgetId[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right })); } catch {/* noop */}
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (col: "left" | "right") => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const order = col === "left" ? leftOrder : rightOrder;
    const setOrder = col === "left" ? setLeftOrder : setRightOrder;
    const oldIndex = order.indexOf(active.id as WidgetId);
    const newIndex = order.indexOf(over.id as WidgetId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    persist(col === "left" ? next : leftOrder, col === "right" ? next : rightOrder);
  };

  const resetLayout = () => {
    setLeftOrder(DEFAULT_LEFT);
    setRightOrder(DEFAULT_RIGHT);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    toast({ title: "Studio layout reset" });
  };

  const renderColumn = (ids: WidgetId[], col: "left" | "right") => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(col)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {ids.map((id) => {
            const node = renderWidget(id);
            if (!node) return null;
            return (
              <SortableSection key={id} id={id}>
                <WidgetErrorBoundary name={id} onReset={resetLayout}>
                  {node}
                </WidgetErrorBoundary>
              </SortableSection>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleReferencePick}
      />

      <VibeHeader
        project={project}
        clientDisplayName={project.client_name}
        isOwner={isOwner}
        onUpdated={onUpdated}
        collaborators={people}
        onlineUserIds={onlineUserIds}
        currentUserId={currentUserId}
      />

      {/* The phase rail itself now lives in ThriveDesk, above the tab
          content, so it (and its Validate action) stay visible across
          every tab, not just this one -- see StudioPhaseRail.tsx and
          ThriveDesk.tsx's handleValidateStep for the full picture. */}
      {flow.nextStep && <NextStepCard nextStep={flow.nextStep} onAction={onNavigateToTab} />}

      {/* Proactive nudges — render once, responsive layout below */}
      {showAITools && <ProactiveCards project={project} tasks={tasks} onAction={onNavigateToTab} />}

      {/* Autopilot — guided (not autonomous) setup. Only the owner sees the
          resume banner; anyone who wants it can still reopen intentionally. */}
      {isOwner && !project.setup_completed && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => setAutopilotOpen(true)}
            className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 text-left"
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight text-foreground">Finish setting up with Autopilot</p>
              <p className="text-xs text-muted-foreground mt-0.5">Collaborators, milestones, an AI brief and starter tasks — you confirm every step.</p>
            </div>
          </button>
        </div>
      )}
      <AutopilotProjectGuide
        project={project}
        currentUserId={currentUserId}
        open={autopilotOpen}
        onOpenChange={setAutopilotOpen}
        onUpdated={onUpdated}
      />

      {/* Mobile: original single-scroll order */}
      <div className="lg:hidden">
        {isOwner && dropZone}
        {RoomChatButton}
        {tasks.length === 0 && (
          <FirstTimeHint
            storageKey={`desk.studio-intro:${project.id}`}
            title="This is your Studio"
            description="Add the first task, paste a brief, or @mention a collaborator. Thrive will help you turn it into a plan."
            tone="energy"
            className="mb-3"
          />
        )}
        <SendInvoiceNudge project={project as any} />
        {project.workspace_type === "podcast" && (
          <PodcastStudioSection project={project} currentUserId={currentUserId} />
        )}
        {["content","content_creation"].includes(project.workspace_type) && (
          <ContentStudioSection project={project} currentUserId={currentUserId} />
        )}
        {["campaign","brand_campaign"].includes(project.workspace_type) && (
          <CampaignStudioSection project={project} currentUserId={currentUserId} />
        )}
        {["music","music_release"].includes(project.workspace_type) && (
          <MusicStudioSection project={project} currentUserId={currentUserId} />
        )}
        {["modeling","modeling_shoot"].includes(project.workspace_type) && (
          <ModelingStudioSection project={project} currentUserId={currentUserId} />
        )}
        {isEvent && (
          <>
            {/* Brief first — carries the event's main concept */}
            {briefBlock}
            <SectionsBringBackTray projectId={project.id} labels={EVENT_HIDEABLE_LABELS} />
            <HideableSection projectId={project.id} sectionId="event-hero">
              <EventHeroCard project={project} />
            </HideableSection>
            <HideableSection projectId={project.id} sectionId="event-producer">
              <EventProducerDashboard project={project} currentUserId={currentUserId} />
            </HideableSection>
            <HideableSection projectId={project.id} sectionId="event-studio">
              <EventStudioSection project={project} currentUserId={currentUserId} />
            </HideableSection>
            <HideableSection projectId={project.id} sectionId="event-suppliers">
              <EventCrmSection project={project} currentUserId={currentUserId} kind="supplier" />
            </HideableSection>
            <HideableSection projectId={project.id} sectionId="event-talent">
              <EventCrmSection project={project} currentUserId={currentUserId} kind="talent" />
            </HideableSection>
            <HideableSection projectId={project.id} sectionId="event-sponsors">
              <div id="studio-sponsors" className="scroll-mt-20">
                <EventSponsorsKanban project={project} currentUserId={currentUserId} />
              </div>
            </HideableSection>
            {project.created_by === currentUserId && (
              <>
                <HideableSection projectId={project.id} sectionId="event-rsvp">
                  <EventRsvpQuestionsBuilder project={project} currentUserId={currentUserId} />
                </HideableSection>
                <HideableSection projectId={project.id} sectionId="event-matches">
                  <EventGuestMatchesSection project={project} currentUserId={currentUserId} />
                </HideableSection>
                <HideableSection projectId={project.id} sectionId="event-seating">
                  <EventSeatingPlanner project={project} currentUserId={currentUserId} />
                </HideableSection>
                <HideableSection projectId={project.id} sectionId="event-outreach">
                  <EventOutreachSegmentBuilder project={project} currentUserId={currentUserId} />
                </HideableSection>
                <HideableSection projectId={project.id} sectionId="event-recap">
                  <EventPostRecapSection project={project} currentUserId={currentUserId} />
                </HideableSection>
              </>
            )}
          </>
        )}
        {mobileWorkColumn(!isEvent)}
        {mobileSideColumn}
        <div className="h-12" />
      </div>

      {/* Desktop: 2-column draggable widget board */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:px-6 lg:py-4 lg:max-w-[1500px] lg:mx-auto">
        <div className="col-span-12 xl:col-span-8 space-y-3 min-w-0">
          {isOwner && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              {dropZone}
            </div>
          )}
          {/* (ProactiveCards lifted above the responsive split — see top of return) */}
          {project.workspace_type === "podcast" && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <PodcastStudioSection project={project} currentUserId={currentUserId} />
            </div>
          )}
          {["content","content_creation"].includes(project.workspace_type) && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <ContentStudioSection project={project} currentUserId={currentUserId} />
            </div>
          )}
          {["campaign","brand_campaign"].includes(project.workspace_type) && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <CampaignStudioSection project={project} currentUserId={currentUserId} />
            </div>
          )}
          {["music","music_release"].includes(project.workspace_type) && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <MusicStudioSection project={project} currentUserId={currentUserId} />
            </div>
          )}
          {["modeling","modeling_shoot"].includes(project.workspace_type) && (
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <ModelingStudioSection project={project} currentUserId={currentUserId} />
            </div>
          )}
          {isEvent && (
            <>
              {/* Brief first on desktop too */}
              <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                {briefBlock}
              </div>
              <SectionsBringBackTray projectId={project.id} labels={EVENT_HIDEABLE_LABELS} />
              <HideableSection projectId={project.id} sectionId="event-hero">
                <EventHeroCard project={project} />
              </HideableSection>
              <HideableSection projectId={project.id} sectionId="event-producer">
                <EventProducerDashboard project={project} currentUserId={currentUserId} />
              </HideableSection>
              <HideableSection projectId={project.id} sectionId="event-studio" className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <EventStudioSection project={project} currentUserId={currentUserId} />
              </HideableSection>
              <HideableSection projectId={project.id} sectionId="event-suppliers" className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <EventCrmSection project={project} currentUserId={currentUserId} kind="supplier" />
              </HideableSection>
              <HideableSection projectId={project.id} sectionId="event-talent" className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <EventCrmSection project={project} currentUserId={currentUserId} kind="talent" />
              </HideableSection>
              <HideableSection projectId={project.id} sectionId="event-sponsors" className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <div id="studio-sponsors" className="scroll-mt-20">
                  <EventSponsorsKanban project={project} currentUserId={currentUserId} />
                </div>
              </HideableSection>
              {project.created_by === currentUserId && (
                <>
                  <HideableSection projectId={project.id} sectionId="event-rsvp">
                    <EventRsvpQuestionsBuilder project={project} currentUserId={currentUserId} />
                  </HideableSection>
                  <HideableSection projectId={project.id} sectionId="event-matches">
                    <EventGuestMatchesSection project={project} currentUserId={currentUserId} />
                  </HideableSection>
                  <HideableSection projectId={project.id} sectionId="event-seating">
                    <EventSeatingPlanner project={project} currentUserId={currentUserId} />
                  </HideableSection>
                  <HideableSection projectId={project.id} sectionId="event-outreach">
                    <EventOutreachSegmentBuilder project={project} currentUserId={currentUserId} />
                  </HideableSection>
                  <HideableSection projectId={project.id} sectionId="event-recap">
                    <EventPostRecapSection project={project} currentUserId={currentUserId} />
                  </HideableSection>
                </>
              )}
            </>
          )}
          {/* The standing "hover to drag" tip line used to sit here always-on
              -- redundant noise once you notice SortableSection's own grip
              handle already carries the same "Drag to reorder" title/
              aria-label right where you'd actually use it. Kept only the
              action that isn't self-explanatory from the handle alone. */}
          <div className="flex items-center justify-end px-1">
            <button
              type="button"
              onClick={resetLayout}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="Reset to default layout"
            >
              Reset layout
            </button>
          </div>
          {renderColumn(isEvent ? leftOrder.filter((id) => id !== "brief") : leftOrder, "left")}
        </div>
        <aside className="col-span-12 xl:col-span-4 space-y-3 min-w-0">
          {RoomChatButton}
          {renderColumn(rightOrder, "right")}
        </aside>
      </div>
    </div>
  );
};
