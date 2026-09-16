import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Mail, Sparkles, GripVertical, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Applicant {
  id: string;
  applicant_id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  cover_letter: string;
  status: string;
  created_at: string;
  expected_rate?: string;
  ai_match_score?: number;
  match_reasons?: string[];
}

interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

const STAGES: PipelineStage[] = [
  { id: "pending", label: "Applied", color: "bg-muted" },
  { id: "shortlisted", label: "Shortlisted", color: "bg-primary/10" },
  { id: "accepted", label: "Hired", color: "bg-green-500/10" },
  { id: "rejected", label: "Rejected", color: "bg-destructive/10" },
];

interface ApplicantPipelineProps {
  applicants: Applicant[];
  onStatusChange: (applicationId: string, newStatus: string) => void;
}

function DroppableColumn({
  stage,
  applicants,
  children,
}: {
  stage: PipelineStage;
  applicants: Applicant[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-1 min-w-[240px]">
      <div className={`rounded-lg p-3 ${stage.color} mb-2`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{stage.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {applicants.length}
          </Badge>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-lg p-2 transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/20"
        }`}
      >
        <SortableContext
          items={applicants.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableApplicantCard({ applicant }: { applicant: Applicant }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [genLoading, setGenLoading] = useState(false);

  const handleGenerateMemo = async () => {
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-deal-memo", {
        body: { application_id: applicant.id },
      });
      if (error) throw error;
      if (data?.signed_url) {
        window.open(data.signed_url, "_blank");
        toast({ title: "Deal memo generated", description: "PDF opened in a new tab." });
      } else {
        throw new Error("No signed URL returned");
      }
    } catch (e: any) {
      toast({
        title: "Could not generate memo",
        description: e.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setGenLoading(false);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: applicant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-default hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={applicant.avatar_url} />
            <AvatarFallback className="text-xs">
              {applicant.full_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {applicant.full_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {applicant.role}
            </p>
            {applicant.ai_match_score != null && (
              <div className="flex items-center gap-1 mt-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {applicant.ai_match_score}%
                </span>
              </div>
            )}
          </div>
        </div>
        {applicant.expected_rate && (
          <p className="text-xs text-muted-foreground mt-2 pl-6">
            Rate: {applicant.expected_rate}
          </p>
        )}
        <div className="flex gap-1 mt-2 pl-6">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => navigate(`/profile/${applicant.applicant_id}`)}
          >
            <Eye className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => navigate(`/messages?user=${applicant.applicant_id}`)}
          >
            <Mail className="w-3 h-3" />
          </Button>
          {applicant.status === "accepted" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary"
              onClick={handleGenerateMemo}
              disabled={genLoading}
              title="Generate Deal Memo PDF"
            >
              {genLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              <span className="hidden sm:inline">Deal Memo</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OverlayCard({ applicant }: { applicant: Applicant }) {
  return (
    <Card className="shadow-xl border-primary/30 w-[240px]">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={applicant.avatar_url} />
            <AvatarFallback className="text-xs">
              {applicant.full_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{applicant.full_name}</p>
            <p className="text-xs text-muted-foreground">{applicant.role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplicantPipeline({
  applicants,
  onStatusChange,
}: ApplicantPipelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const getApplicantsByStage = (stageId: string) =>
    applicants.filter((a) => a.status === stageId);

  const findStageForApplicant = (applicantId: string) => {
    const applicant = applicants.find((a) => a.id === applicantId);
    return applicant?.status;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // No-op: we handle status changes on drag end only
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const applicantId = active.id as string;
    const overId = over.id as string;

    // Determine target stage
    let targetStage: string | undefined;

    // If dropped on a stage column directly
    if (STAGES.some((s) => s.id === overId)) {
      targetStage = overId;
    } else {
      // Dropped on another applicant card — find that card's stage
      targetStage = findStageForApplicant(overId);
    }

    if (!targetStage) return;

    const currentStage = findStageForApplicant(applicantId);
    if (currentStage === targetStage) return;

    onStatusChange(applicantId, targetStage);
  };

  const activeApplicant = activeId
    ? applicants.find((a) => a.id === activeId)
    : null;

  return (
    <div className="mt-4">
      {/* Pipeline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {STAGES.map((stage) => {
          const count = getApplicantsByStage(stage.id).length;
          return (
            <div
              key={stage.id}
              className={`rounded-lg p-3 text-center ${stage.color}`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{stage.label}</p>
            </div>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageApplicants = getApplicantsByStage(stage.id);
            return (
              <DroppableColumn
                key={stage.id}
                stage={stage}
                applicants={stageApplicants}
              >
                {stageApplicants.map((applicant) => (
                  <SortableApplicantCard
                    key={applicant.id}
                    applicant={applicant}
                  />
                ))}
                {stageApplicants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Drag applicants here
                  </p>
                )}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeApplicant ? (
            <OverlayCard applicant={activeApplicant} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
