import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNowStrict, format } from "date-fns";
import {
  Search,
  AlertTriangle,
  FolderInput,
  Plus,
  Calendar,
  Users,
  Video,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  MoreVertical,
  Zap,
  FileText,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Target,
  Briefcase,
  CheckSquare,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
  GanttChart as TimelineIcon,
  UserCheck,
  XCircle,
  Eye,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { BrandLoader } from "@/components/brand/BrandDots";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { moodAccent, monogram, STATUS_PILL, PAY_DOT, PAY_LABEL, type StudioProject } from "./studioCardHelpers";
import { MoveToFolderSheet } from "./MoveToFolderSheet";
import { prioritizeProjects } from "./studioHome.selectors";
import type { StudioFolder } from "./studioHome.types";
import { HoloCard } from "@/components/passport/HoloCard";
import { WORKSPACE_CONFIGS, type WorkspaceType } from "@/lib/workspaceConfigs";

type PayState = "paid" | "invoiced" | "unsent";
type StatusFilter = "all" | "active" | "completed";
type SortKey = "recent" | "title" | "status";
type OverviewTab = "overview" | "work" | "people" | "files" | "decisions" | "activity";
type BoardView = "board" | "list" | "timeline" | "my-work";

interface Task {
  id: string;
  title: string;
  owner?: { name: string; avatar?: string; initials: string };
  dueDate?: string;
  status: "pending" | "in_progress" | "review" | "done" | "blocked";
  isCollaborative?: boolean;
  dependencies?: number;
  progress?: number;
  phase: "kickoff" | "build" | "wrap" | "complete";
}

interface Decision {
  id: string;
  title: string;
  comments?: number;
  status: "open" | "resolved";
}

interface Call {
  id: string;
  title: string;
  date: string;
  hasNotes?: boolean;
}

interface Activity {
  id: string;
  type: "update" | "call" | "task" | "suggestion";
  description: string;
  timestamp: string;
  user?: string;
}

interface Blocker {
  id: string;
  title: string;
  description: string;
  phase: string;
}

interface StudioProjectsDashboardProps {
  projects: StudioProject[];
  invoicesByProject?: Record<string, PayState>;
  canSeeMoney?: boolean;
  moneyVisibleByProject?: Record<string, boolean>;
  participantsByProject?: Record<string, number>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate: () => void;
  folders?: StudioFolder[];
  onMoveToFolder?: (projectId: string, folderId: string | null) => void;
  projectId?: string;
}

const STATUS_RANK: Record<string, number> = {
  active: 0,
  planning: 1,
  wrapping: 2,
  completed: 3,
  archived: 4,
};

const isDelivered = (s?: string | null) => s === "completed" || s === "archived";

const PHASE_LABELS: Record<string, string> = {
  kickoff: "Kickoff",
  build: "Build",
  wrap: "Wrap",
  complete: "Complete",
};

/**
 * Projects dashboard — wireframe-aligned with CDO specs
 * Includes:
 * - Project list (Studios view)
 * - Project Room (Overview tab)
 * - Production Board (Kickoff/Build/Wrap/Complete with Board/List/Timeline/My Work views)
 */
export const StudioProjectsDashboard = ({
  projects,
  invoicesByProject = {},
  canSeeMoney = true,
  moneyVisibleByProject,
  participantsByProject = {},
  loading = false,
  error = null,
  onRetry,
  onCreate,
  folders = [],
  onMoveToFolder,
  projectId,
}: StudioProjectsDashboardProps) => {
  const navigate = useNavigate();
  const params = useParams<{ projectId: string }>();
  const currentProjectId = projectId || params.projectId;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [moveTarget, setMoveTarget] = useState<StudioProject | null>(null);
  const carouselRef = useRef<HTMLUListElement>(null);
  const [carouselPosition, setCarouselPosition] = useState(0);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const [activeTab, setActiveTab] = useState<OverviewTab>("overview");
  const [boardView, setBoardView] = useState<BoardView>("board");

  const pay = (id: string): PayState => invoicesByProject[id] ?? "unsent";

  const moneyVisible = (id: string): boolean =>
    moneyVisibleByProject ? (moneyVisibleByProject[id] ?? false) : canSeeMoney;

  const anyMoneyVisible = moneyVisibleByProject ? Object.values(moneyVisibleByProject).some(Boolean) : canSeeMoney;

  const counts = useMemo(() => {
    const all = projects.length;
    const active = projects.filter((p) => !isDelivered(p.status)).length;
    const completed = projects.filter((p) => isDelivered(p.status)).length;
    return { all, active, completed };
  }, [projects]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (q && !`${p.title} ${p.client_name ?? ""}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "active":
          return !isDelivered(p.status);
        case "completed":
          return isDelivered(p.status);
        default:
          return true;
      }
    });

    if (sort === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "status") {
      list = [...list].sort((a, b) => {
        const d = (STATUS_RANK[a.status ?? "active"] ?? 1) - (STATUS_RANK[b.status ?? "active"] ?? 1);
        return d !== 0 ? d : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    } else {
      list = prioritizeProjects(list, invoicesByProject, moneyVisibleByProject);
    }
    return list;
  }, [projects, invoicesByProject, moneyVisibleByProject, query, filter, sort]);

  const syncCarousel = () => {
    const list = carouselRef.current;
    if (!list) return;
    const firstCard = list.querySelector("li");
    const step = firstCard ? firstCard.getBoundingClientRect().width + 12 : 1;
    setCarouselPosition(Math.min(rows.length - 1, Math.max(0, Math.round(list.scrollLeft / step))));
    setCanScrollForward(list.scrollLeft + list.clientWidth < list.scrollWidth - 2);
  };

  useEffect(() => {
    const list = carouselRef.current;
    if (!list) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncCarousel);
    observer.observe(list);
    syncCarousel();
    return () => observer.disconnect();
  }, [rows]);

  const moveCarousel = (direction: -1 | 1) => {
    const list = carouselRef.current;
    const firstCard = list?.querySelector("li");
    if (!list || !firstCard) return;
    list.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + 12), behavior: "smooth" });
  };

  useEffect(() => {
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
    setCarouselPosition(0);
  }, [query, filter, sort]);

  const nextAction = (p: StudioProject) => {
    if (!isDelivered(p.status)) {
      if (p.status === "wrapping") return "Wrap it up";
      if (p.status === "planning") return "Add the first tasks";
      return "Open the work feed";
    }
    if (!moneyVisible(p.id)) return "Review the delivery";
    const state = pay(p.id);
    if (state === "unsent") return "Draft the invoice";
    if (state === "invoiced") return "Chase the payment";
    return "Log the credits";
  };

  // Mock data for Project Room Overview
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const mockTasks: Task[] = currentProjectId
    ? [
        // Kickoff
        {
          id: "1",
          title: "Concept Lock & Brand Guidelines",
          owner: { name: "Jefferson", avatar: "", initials: "JG" },
          dueDate: "Today",
          status: "review",
          phase: "kickoff",
        },
        {
          id: "2",
          title: "Audience & Competitive Analysis",
          owner: { name: "Ethan", avatar: "", initials: "EA" },
          dueDate: "",
          status: "in_progress",
          progress: 75,
          dependencies: 2,
          phase: "kickoff",
        },
        {
          id: "3",
          title: "Campaign Narrative",
          owner: { name: "Jefferson", avatar: "", initials: "JG" },
          dueDate: "Sep 30",
          status: "pending",
          phase: "kickoff",
        },
        // Build
        {
          id: "4",
          title: "Animation Production & Storyboard Review",
          dueDate: "Oct 02",
          status: "pending",
          phase: "build",
        },
        {
          id: "5",
          title: "Sound Design & Music Composition",
          status: "blocked",
          phase: "build",
          dependencies: 1,
        },
        {
          id: "6",
          title: "Character Design & 3D Model Refinement",
          dueDate: "Oct 05",
          status: "in_progress",
          progress: 50,
          dependencies: 2,
          phase: "build",
        },
        // Wrap
        {
          id: "7",
          title: "Final Edit & Color Grade",
          status: "pending",
          phase: "wrap",
          dependencies: 1,
        },
        {
          id: "8",
          title: "Marketing Asset Package Creation",
          status: "pending",
          phase: "wrap",
          dependencies: 5,
        },
        {
          id: "9",
          title: "Credits & Contribution Review",
          status: "pending",
          phase: "wrap",
          dependencies: 3,
        },
        // Complete
        {
          id: "10",
          title: "Full Reveal Campaign Launch & Monitoring",
          status: "pending",
          phase: "complete",
        },
        {
          id: "11",
          title: "Final project record & wrap",
          status: "pending",
          phase: "complete",
        },
      ]
    : [];

  const mockBlockers: Blocker[] = currentProjectId
    ? [
        {
          id: "1",
          title: "Sound Design & Music Composition",
          description: "Waiting on approved creative brief",
          phase: "build",
        },
      ]
    : [];

  const mockActivity: Activity[] = currentProjectId
    ? [
        {
          id: "1",
          type: "update",
          description: "Jefferson updated Concept Lock & Brand Guidelines",
          timestamp: "2h ago",
          user: "Jefferson",
        },
        {
          id: "2",
          type: "task",
          description: "Ethan added two findings to Audience Analysis",
          timestamp: "5h ago",
          user: "Ethan",
        },
        {
          id: "3",
          type: "suggestion",
          description: "Kreto suggested separating music composition from final sound design",
          timestamp: "Yesterday",
          user: "Kreto",
        },
      ]
    : [];

  const progress = currentProject
    ? isDelivered(currentProject.status)
      ? 100
      : currentProject.status === "wrapping"
        ? 75
        : currentProject.status === "planning"
          ? 25
          : 50
    : 0;

  const getTasksByPhase = (phase: string) => mockTasks.filter((t) => t.phase === phase);

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "bg-success/10 text-success border-success/20";
      case "review":
        return "bg-primary/10 text-primary border-primary/20";
      case "in_progress":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "blocked":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-3 w-3" />;
      case "review":
        return <Eye className="h-3 w-3" />;
      case "in_progress":
        return <Zap className="h-3 w-3" />;
      case "blocked":
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Project Room with Production Board
  if (currentProject) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{currentProject.title}</h1>
            <p className="text-sm text-muted-foreground">
              Active · Production workspace · {participantsByProject[currentProject.id] ?? 0} people
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Kreto
            </Button>
            <Button variant="outline" size="sm">
              <Video className="mr-2 h-4 w-4" />
              Call
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Invite
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Phase progress */}
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Production Flow · {progress}% complete
                </p>
                <p className="text-sm font-medium">1 blocker · 2 items awaiting review</p>
              </div>
              <Button variant="outline" size="sm">
                Open attention queue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Phase timeline */}
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary">Kickoff</Badge>
              <Separator className="flex-1" />
              <Badge variant="outline">Build</Badge>
              <Separator className="flex-1" />
              <Badge variant="outline">Wrap</Badge>
              <Separator className="flex-1" />
              <Badge variant="outline">Complete</Badge>
            </div>
          </CardContent>
        </Card>

        {/* View switcher */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Work</h2>
          <div className="flex items-center gap-2">
            <Select value={boardView} onValueChange={(v) => setBoardView(v as BoardView)}>
              <SelectTrigger className="w-40" aria-label="View mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Board
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <ListIcon className="h-4 w-4" />
                    List
                  </div>
                </SelectItem>
                <SelectItem value="timeline">
                  <div className="flex items-center gap-2">
                    <TimelineIcon className="h-4 w-4" />
                    Timeline
                  </div>
                </SelectItem>
                <SelectItem value="my-work">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    My work
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
        </div>

        {/* Production Board */}
        {boardView === "board" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* Kickoff */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Kickoff</h3>
                  <Badge variant="outline">{getTasksByPhase("kickoff").length} items</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getTasksByPhase("kickoff").map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors hover:border-primary/30",
                      task.status === "review" && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge className={cn("text-[10px]", getStatusColor(task.status))}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1">
                          {task.status === "review"
                            ? "Ready for review"
                            : task.status === "in_progress"
                              ? "In progress"
                              : task.status}
                        </span>
                      </Badge>
                      {task.owner && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.owner.avatar} />
                          <AvatarFallback className="text-[9px]">{task.owner.initials}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {task.owner?.name || "Needs owner"} {task.dueDate && `· ${task.dueDate}`}
                      </span>
                      {task.dependencies && (
                        <span className="inline-flex items-center gap-1">
                          <FolderInput className="h-2.5 w-2.5" />
                          {task.dependencies} tasks
                        </span>
                      )}
                    </div>
                    {task.progress !== undefined && <Progress value={task.progress} className="mt-2 h-1" />}
                    {task.status === "review" && (
                      <Button variant="outline" size="sm" className="mt-2 w-full text-xs">
                        Review
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Build */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Build</h3>
                  <Badge variant="outline">{getTasksByPhase("build").length} items</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getTasksByPhase("build").map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors hover:border-primary/30",
                      task.status === "blocked" && "border-destructive/40 bg-destructive/5",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge className={cn("text-[10px]", getStatusColor(task.status))}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1">
                          {task.status === "blocked"
                            ? "Blocked"
                            : task.status === "in_progress"
                              ? "In progress"
                              : task.status}
                        </span>
                      </Badge>
                      {task.owner && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.owner.avatar} />
                          <AvatarFallback className="text-[9px]">{task.owner.initials}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {task.owner?.name || "Needs owner"} {task.dueDate && `· ${task.dueDate}`}
                      </span>
                      {task.dependencies && (
                        <span className="inline-flex items-center gap-1">
                          <FolderInput className="h-2.5 w-2.5" />
                          {task.dependencies} tasks
                        </span>
                      )}
                    </div>
                    {task.progress !== undefined && <Progress value={task.progress} className="mt-2 h-1" />}
                    {task.status === "blocked" && (
                      <Button variant="outline" size="sm" className="mt-2 w-full text-xs text-destructive">
                        Resolve
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Wrap */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Wrap</h3>
                  <Badge variant="outline">{getTasksByPhase("wrap").length} items</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getTasksByPhase("wrap").map((task) => (
                  <div key={task.id} className="rounded-lg border p-3 transition-colors hover:border-primary/30">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge className={cn("text-[10px]", getStatusColor(task.status))}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1">{task.status}</span>
                      </Badge>
                      {task.owner && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.owner.avatar} />
                          <AvatarFallback className="text-[9px]">{task.owner.initials}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {task.owner?.name || "Needs owner"} {task.dueDate && `· ${task.dueDate}`}
                      </span>
                      {task.dependencies && (
                        <span className="inline-flex items-center gap-1">
                          <FolderInput className="h-2.5 w-2.5" />
                          {task.dependencies} deliverables
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Complete */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Complete</h3>
                  <Badge variant="outline">{getTasksByPhase("complete").length} items</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getTasksByPhase("complete").map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm font-medium text-muted-foreground">{task.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{task.dueDate || "After approval"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <LayoutGrid className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {boardView === "list"
                  ? "List view — all tasks in a sortable table"
                  : boardView === "timeline"
                    ? "Timeline view — Gantt-style schedule"
                    : "My Work view — tasks assigned to you"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Attention queue */}
        {mockBlockers.length > 0 && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold">Attention</h3>
              </div>
              {mockBlockers.map((blocker) => (
                <div key={blocker.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{blocker.title}</p>
                      <p className="text-xs text-muted-foreground">{blocker.description}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Resolve blocker
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Activity */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Activity</h3>
              <Button variant="ghost" size="sm">
                View all
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {mockActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[9px]">{activity.user?.[0] || "A"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-[11px] text-muted-foreground">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Studios list view (wireframe 01)
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <BrandLoader fullscreen={false} size="sm" className="mx-auto mb-2" />
        Loading your Projects…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <p className="text-sm font-semibold">We couldn't load your Projects.</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
        <h3 className="text-base font-bold">No Projects yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          A Project keeps the brief, the work, the people and the proof of what happened in one place. Start with what
          you're making.
        </p>
        <div className="mt-5 flex justify-center">
          <CtaButton onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first Project
          </CtaButton>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Studio projects" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto shrink-0 text-xs font-semibold text-muted-foreground">{rows.length} {rows.length === 1 ? "project" : "projects"}</span>
        <div className="relative min-w-36 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Projects"
            aria-label="Search Projects"
            className="h-9 pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
          <SelectTrigger className="w-28" aria-label="Project status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-32" aria-label="Sort Projects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="title">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create
        </Button>
      </div>

      {/* One continuous, keyboard-scrollable shelf: every matching project remains available. */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No Projects match this view.{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul
          id="studio-projects-list"
          ref={carouselRef}
          onScroll={syncCarousel}
          aria-label="Studio projects"
          tabIndex={0}
          className="flex gap-3 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [scrollbar-width:thin] motion-reduce:scroll-auto"
        >
          {rows.map((p) => {
            const pill = STATUS_PILL[p.status ?? "active"] ?? STATUS_PILL.planning;
            const state = pay(p.id);
            const accent = moodAccent(p.mood);
            const workspaceLabel = p.workspace_type
              ? WORKSPACE_CONFIGS[p.workspace_type as WorkspaceType]?.label
              : null;
            const participants = participantsByProject[p.id] ?? 0;
            const projProgress = isDelivered(p.status)
              ? 100
              : p.status === "wrapping"
                ? 75
                : p.status === "planning"
                  ? 25
                  : 50;

            return (
              <li key={p.id} className="group relative w-[min(82vw,300px)] shrink-0 snap-start sm:w-[300px]">
                <HoloCard className="h-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => navigate(`/desk/${p.id}`)}
                    className="block w-full bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    {/* Cover */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                      {p.cover_url ? (
                        <img
                          src={p.cover_url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${accent}33, transparent)`,
                          }}
                        >
                          <span className="text-2xl font-black tracking-tight" style={{ color: accent }}>
                            {monogram(p.title)}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn(
                          "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm",
                          pill.tone,
                        )}
                      >
                        {pill.label}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{p.title}</span>
                        {workspaceLabel && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {workspaceLabel}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.client_name || p.description || "No client set"}
                      </p>
                      <div className="space-y-1">
                        <Progress value={projProgress} className="h-1" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{projProgress}% complete</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Updated {formatDistanceToNowStrict(new Date(p.updated_at))} ago
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        <p className="text-[11px] font-semibold text-foreground/80">{nextAction(p)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {p.deadline && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(p.deadline), "MMM d")}
                          </span>
                        )}
                        {participants > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {participants}
                          </span>
                        )}
                        {moneyVisible(p.id) && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[state])} />
                            {PAY_LABEL[state]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-t border-border/60 bg-card p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={() => navigate(`/desk/${p.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={() => navigate(`/desk/${p.id}?joinCall=1`)}
                    >
                      <Video className="h-3 w-3" />
                      Call
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("thrive-copilot:open", {
                            detail: { projectId: p.id },
                          }),
                        )
                      }
                    >
                      <Sparkles className="h-3 w-3" />
                      Ask
                    </Button>
                    {onMoveToFolder && folders.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={`Move ${p.title} to a folder`}
                        onClick={() => setMoveTarget(p)}
                      >
                        <FolderInput className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </HoloCard>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 1 && (
        <div className="flex items-center justify-between gap-3" aria-label="Project carousel controls">
          <span className="text-xs tabular-nums text-muted-foreground">{carouselPosition + 1} / {rows.length}</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moveCarousel(-1)} disabled={carouselPosition === 0} aria-label="Previous project">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moveCarousel(1)} disabled={!canScrollForward} aria-label="Next project">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Move to folder */}
      {onMoveToFolder && (
        <MoveToFolderSheet
          open={!!moveTarget}
          onOpenChange={(v) => !v && setMoveTarget(null)}
          folders={folders}
          currentFolderId={moveTarget?.studio_folder_id ?? null}
          projectTitle={moveTarget?.title}
          onMove={(folderId) => {
            if (moveTarget) onMoveToFolder(moveTarget.id, folderId);
            setMoveTarget(null);
          }}
        />
      )}
    </section>
  );
};

export default StudioProjectsDashboard;
