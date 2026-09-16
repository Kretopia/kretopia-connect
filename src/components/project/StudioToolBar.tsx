import { ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  resolveTabs,
  TAB_META,
  getTabLabel,
  type WorkspaceType,
  type DealType,
  type DeskTabKey,
} from "@/lib/workspaceConfigs";

interface StudioToolBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  workspaceType?: WorkspaceType | null;
  dealType?: DealType | null;
  taskCount?: number;
  messageCount?: number;
}

/**
 * Unified top bar for tool views (chat, tasks, files, etc.).
 * Mirrors the mobile pattern on desktop: ← Studio · {Tool} · More tools ▾
 * Replaces the busy horizontal tab strip with a clean, focused header.
 */
export function StudioToolBar({
  activeTab,
  onTabChange,
  workspaceType,
  dealType,
  taskCount,
  messageCount,
}: StudioToolBarProps) {
  const tabs = resolveTabs(
    (workspaceType ?? "general") as WorkspaceType,
    (dealType ?? "paid") as DealType,
  ).filter((t) => t !== "today");

  const meta = TAB_META[activeTab as DeskTabKey];
  const Icon = meta?.icon;
  const currentLabel = meta
    ? getTabLabel(activeTab as DeskTabKey, (workspaceType ?? "general") as WorkspaceType)
    : activeTab.replace(/_/g, " ");

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs gap-1"
        onClick={() => onTabChange("today")}
      >
        <ArrowLeft className="h-4 w-4" />
        Studio
      </Button>

      <span className="text-muted-foreground/50">/</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-sm font-semibold gap-1.5"
          >
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <span className="capitalize">{currentLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-[70vh] overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Switch tool
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tabs.map((id) => {
            const m = TAB_META[id];
            if (!m) return null;
            const ItemIcon = m.icon;
            const label = getTabLabel(id, (workspaceType ?? "general") as WorkspaceType);
            const count =
              id === "tasks" ? taskCount : id === "messages" ? messageCount : undefined;
            const active = activeTab === id;
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => onTabChange(id)}
                className={active ? "bg-accent text-accent-foreground" : ""}
              >
                <ItemIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                {count !== undefined && count > 0 && (
                  <span className="ml-2 min-w-[18px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
