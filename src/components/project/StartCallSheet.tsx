import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Loader2,
  Link2,
  Check,
  Video,
  Users,
  UserCircle2,
  Globe,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface StartCallPerson {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: string | null;
  source: "project" | "connection" | "search";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
  /** Project members (preselected by default for project calls). */
  projectMembers: StartCallPerson[];
  /** Called when host taps "Start call". Pass selected userIds + a flag indicating link-only. */
  onStart: (opts: {
    inviteUserIds: string[];
    sharedGuestLink: boolean;
    guestLinkUrl?: string;
  }) => Promise<void> | void;
  starting: boolean;
}

const initials = (name: string | null | undefined) =>
  (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * Pre-call "Who's joining?" sheet. Opens BEFORE the room is created, so the
 * host curates the guest list, then taps Start to mint the room + ring people.
 *
 * Tabs: Project · Network · Search · plus inline guest-link share (WhatsApp etc).
 */
export const StartCallSheet = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectMembers,
  onStart,
  starting,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"project" | "network" | "search">(
    projectId ? "project" : "network",
  );
  const [connections, setConnections] = useState<StartCallPerson[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StartCallPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, StartCallPerson>>(new Map());
  const [generatingLink, setGeneratingLink] = useState(false);

  // Stable key from member ids so a new array reference each render
  // doesn't re-fire this effect (which was clobbering selection / closing UX).
  const memberKey = useMemo(
    () => projectMembers.map((p) => p.user_id).sort().join(","),
    [projectMembers],
  );

  // Reset on open / preselect project members for project calls
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      // Preselect all project members so host doesn't have to re-pick them
      const m = new Map<string, StartCallPerson>();
      projectMembers.forEach((p) => m.set(p.user_id, p));
      setSelected(m);
      setTab(projectId ? "project" : "network");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, memberKey]);

  // Load connections
  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("connections")
        .select("user_id, connected_user_id")
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
        .eq("status", "accepted");
      const otherIds = new Set<string>();
      (data || []).forEach((c) => {
        otherIds.add(c.user_id === user.id ? c.connected_user_id : c.user_id);
      });
      if (!otherIds.size) {
        setConnections([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", Array.from(otherIds))
        .limit(200);
      setConnections(
        (profiles || []).map((p) => ({ ...p, source: "connection" as const })),
      );
    })().catch((e) => console.warn("[StartCallSheet] connections", e));
  }, [open, user?.id]);

  // Search platform users (debounced)
  useEffect(() => {
    if (tab !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .ilike("full_name", `%${q}%`)
          .neq("user_id", user?.id ?? "")
          .limit(20);
        setSearchResults(
          (data || []).map((p) => ({ ...p, source: "search" as const })),
        );
      } catch (e) {
        console.warn("[StartCallSheet] search", e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, tab, user?.id]);

  const visible = useMemo(() => {
    if (tab === "project") return projectMembers;
    if (tab === "network") return connections;
    return searchResults;
  }, [tab, projectMembers, connections, searchResults]);

  const toggleSelect = (p: StartCallPerson) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.user_id)) next.delete(p.user_id);
      else next.set(p.user_id, p);
      return next;
    });
  };

  const handleStart = async () => {
    await onStart({
      inviteUserIds: Array.from(selected.keys()),
      sharedGuestLink: false,
    });
  };

  const handleShareWhatsApp = async () => {
    setGeneratingLink(true);
    try {
      // We need a room first to mint a guest link. Tell parent to start, then
      // share the link as part of the start payload using a side-channel:
      // simpler — start the call with a flag so parent generates+returns link.
      await onStart({
        inviteUserIds: Array.from(selected.keys()),
        sharedGuestLink: true,
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const tabs: { id: typeof tab; label: string; icon: typeof Users; show: boolean }[] = [
    { id: "project", label: "From this project", icon: Users, show: !!projectId && projectMembers.length > 0 },
    { id: "network", label: "My connections", icon: UserCircle2, show: true },
    { id: "search", label: "Anyone on Kretopia", icon: Globe, show: true },
  ];

  const selectedCount = selected.size;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] p-0 flex flex-col bg-background gap-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0 text-left">
          <SheetTitle className="text-lg font-semibold">Who's joining the call?</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pick who to ring on{" "}
            <span className="font-medium text-foreground">{projectName}</span>, or share a link.
          </p>
        </SheetHeader>

        {/* Quick share row — guest link / WhatsApp */}
        <div className="px-4 py-3 border-b border-border shrink-0 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShareWhatsApp}
            disabled={generatingLink || starting}
            className="flex-1 h-11 rounded-full gap-2 justify-center"
          >
            {generatingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">Start &amp; share link</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
          {tabs
            .filter((t) => t.show)
            .map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
        </div>

        {/* Search input on search tab */}
        {tab === "search" && (
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people on Kretopia…"
                className="pl-9 rounded-full h-10"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* People list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "search" && searchQuery.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 text-muted-foreground gap-2 py-12">
              <Search className="h-8 w-8 opacity-40" />
              <p className="text-sm">Type a name to search Kretopia</p>
            </div>
          ) : searching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-8 text-muted-foreground gap-2 py-12">
              <Users className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {tab === "project"
                  ? "No other project members yet."
                  : tab === "network"
                    ? "You haven't connected with anyone yet."
                    : "No matches."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((p) => {
                const isSelected = selected.has(p.user_id);
                return (
                  <li key={p.user_id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.full_name || "Unnamed"}
                        </p>
                        {p.role && (
                          <p className="text-xs text-muted-foreground truncate">
                            {p.role}
                          </p>
                        )}
                      </div>
                      <span
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sticky footer — Start call */}
        <div
          className="px-4 pt-3 border-t border-border shrink-0 bg-background"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <Button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="w-full h-12 rounded-full gap-2 text-base font-semibold"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            {selectedCount > 0
              ? `Start call & ring ${selectedCount} ${selectedCount === 1 ? "person" : "people"}`
              : "Start call (just me)"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
            <Link2 className="h-3 w-3" />
            You can copy a guest link from inside the call too
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
