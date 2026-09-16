import { Folder, FolderMinus, FolderPlus, Check, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { StudioFolder } from "./StudioFoldersBar";

// Same six keys as StudioFoldersBar.tsx's COLOR_TINT, kept in sync —
// shades of brand pink + neutral gray, no rainbow. "magenta"/"yellow"
// used to reference --signal-magenta/--signal-yellow, which don't exist
// anywhere in index.css, so those two were silently invisible before.
const COLOR_INK: Record<string, string> = {
  teal: "text-[hsl(327_100%_59%)]",
  magenta: "text-[hsl(327_85%_50%)]",
  yellow: "text-[hsl(240_8%_60%)]",
  green: "text-[hsl(327_60%_68%)]",
  blue: "text-[hsl(240_6%_40%)]",
  purple: "text-[hsl(327_45%_75%)]",
};
const COLOR_BG: Record<string, string> = {
  teal: "bg-[hsl(327_100%_59%)]/10",
  magenta: "bg-[hsl(327_85%_50%)]/10",
  yellow: "bg-[hsl(240_8%_60%)]/10",
  green: "bg-[hsl(327_60%_68%)]/10",
  blue: "bg-[hsl(240_6%_40%)]/10",
  purple: "bg-[hsl(327_45%_75%)]/10",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: StudioFolder[];
  currentFolderId?: string | null;
  projectTitle?: string;
  onMove: (folderId: string | null) => void;
  onCreateFolder?: () => void;
}

export const MoveToFolderSheet = ({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  projectTitle,
  onMove,
  onCreateFolder,
}: Props) => {
  const pick = (id: string | null) => {
    onMove(id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[80vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">Move to folder</SheetTitle>
          {projectTitle && (
            <p className="text-xs text-muted-foreground truncate">{projectTitle}</p>
          )}
        </SheetHeader>

        <div className="mt-3 space-y-1">
          {/* Unfiled */}
          <button
            onClick={() => pick(null)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
              "hover:bg-muted active:bg-muted",
              !currentFolderId && "bg-muted",
            )}
          >
            <span className="h-10 w-10 rounded-xl bg-muted grid place-items-center">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold">Unfiled</span>
              <span className="block text-[11px] text-muted-foreground">
                No folder
              </span>
            </span>
            {!currentFolderId && <Check className="h-4 w-4 text-[hsl(var(--energy))]" />}
          </button>

          {folders.map((f) => {
            const color = (f.color || "teal").toLowerCase();
            const active = f.id === currentFolderId;
            return (
              <button
                key={f.id}
                onClick={() => pick(f.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                  "hover:bg-muted active:bg-muted",
                  active && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "h-10 w-10 rounded-xl grid place-items-center",
                    COLOR_BG[color] ?? COLOR_BG.teal,
                  )}
                >
                  <Folder className={cn("h-5 w-5", COLOR_INK[color] ?? COLOR_INK.teal)} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold truncate">{f.name}</span>
                </span>
                {active && <Check className="h-4 w-4 text-[hsl(var(--energy))]" />}
              </button>
            );
          })}

          {onCreateFolder && (
            <button
              onClick={() => {
                onOpenChange(false);
                onCreateFolder();
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span className="h-10 w-10 rounded-xl border border-dashed border-border grid place-items-center">
                <FolderPlus className="h-5 w-5" />
              </span>
              <span className="text-[14px] font-semibold">New folder</span>
            </button>
          )}

          {currentFolderId && (
            <button
              onClick={() => pick(null)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-destructive hover:bg-destructive/10 transition-colors"
            >
              <span className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center">
                <FolderMinus className="h-5 w-5" />
              </span>
              <span className="text-[14px] font-semibold">Remove from folder</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
