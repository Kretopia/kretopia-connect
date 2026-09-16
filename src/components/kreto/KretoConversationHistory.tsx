import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  History, Plus, Search, Pencil, Archive, Trash2, Check, X, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listConversations, renameConversation, archiveConversation, deleteConversation,
  type CopilotConversationSummary,
} from "@/lib/thriveCopilot";

interface KretoConversationHistoryProps {
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Bump this whenever the parent knows the list changed underneath it
   *  (e.g. a new conversation was just created by sending a first message). */
  refreshKey?: number;
}

/**
 * Kreto's conversation history — a fixed rail on desktop, an accessible
 * Sheet on mobile (opened from a History button), sharing the same list.
 * Renders only real, owned conversations (RLS-scoped) — no invented
 * activity, no placeholder rows.
 */
export function KretoConversationHistory(props: KretoConversationHistoryProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setSheetOpen(true)}
        >
          <History className="h-3.5 w-3.5" /> History
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
            <SheetHeader className="p-4 pb-2 text-left">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <ConversationListBody
                {...props}
                onSelect={(id) => { props.onSelect(id); setSheetOpen(false); }}
                onNew={() => { props.onNew(); setSheetOpen(false); }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-white/10 flex flex-col h-full">
      <ConversationListBody {...props} />
    </div>
  );
}

function ConversationListBody({ activeConversationId, onSelect, onNew, refreshKey }: KretoConversationHistoryProps) {
  const [conversations, setConversations] = useState<CopilotConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listConversations()
      .then(setConversations)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  const filtered = query.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
    : conversations;

  const startRename = (c: CopilotConversationSummary) => {
    setRenamingId(c.id);
    setRenameValue(c.title);
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    const ok = await renameConversation(id, title);
    if (ok) refresh();
    else toast.error("Couldn't rename that conversation");
  };

  const handleArchive = async (id: string) => {
    const ok = await archiveConversation(id);
    if (ok) {
      toast.success("Conversation archived");
      if (activeConversationId === id) onNew();
      refresh();
    } else {
      toast.error("Couldn't archive that conversation");
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(null);
    const ok = await deleteConversation(id);
    if (ok) {
      toast.success("Conversation deleted");
      if (activeConversationId === id) onNew();
      refresh();
    } else {
      toast.error("Couldn't delete that conversation");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-white/10">
        <Button type="button" size="sm" className="w-full gap-1.5 justify-start" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" /> New conversation
        </Button>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="h-8 pl-8 text-xs bg-white/[0.03] border-white/10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs text-white/40">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-xs text-white/40 flex flex-col items-center text-center gap-1.5 mt-4">
            <MessageSquare className="h-5 w-5 text-white/20" />
            {query ? "No conversations match that search." : "No conversations yet — start one above."}
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((c) => (
              <li key={c.id} className="group relative">
                {renamingId === c.id ? (
                  <div className="flex items-center gap-1 px-2.5 py-1.5">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(c.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-7 text-xs bg-white/[0.05] border-white/10"
                      maxLength={120}
                    />
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => commitRename(c.id)} aria-label="Save name">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)} aria-label="Cancel rename">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 hover:bg-white/[0.04] transition-colors ${
                      activeConversationId === c.id ? "bg-white/[0.06]" : ""
                    }`}
                    aria-current={activeConversationId === c.id ? "true" : undefined}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{c.title}</span>
                      <span className="block text-[11px] text-white/40">
                        {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                      </span>
                    </span>
                    {!c.isPrimary && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 h-6 w-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label={`Options for ${c.title}`}
                          >
                            <span aria-hidden>⋯</span>
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => startRename(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchive(c.id)}>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPendingDeleteId(c.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the conversation and every message in it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default KretoConversationHistory;
