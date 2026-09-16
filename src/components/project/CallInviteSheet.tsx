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
  Phone,
  Users,
  Share2,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ringUsers } from "@/hooks/useIncomingCall";
import { APP_URL } from "@/lib/constants";

interface Person {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callContext: {
    kind: "project" | "direct";
    projectId?: string | null;
    projectName: string;
    directCallId?: string | null;
    roomUrl: string;
    roomName: string;
    callId?: string | null;
    callerName: string;
    callerAvatar?: string | null;
    meetingShareUrl?: string | null;
  };
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
 * Simplified invite flow:
 *  1. Send link  — share/copy the meeting URL (works for anyone)
 *  2. From contacts — pick from project members + connections, then ring
 */
export const CallInviteSheet = ({ open, onOpenChange, callContext }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Person[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, Person>>(new Map());
  const [ringing, setRinging] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Reset when reopening
  useEffect(() => {
    if (!open) {
      setSelected(new Map());
      setQuery("");
      setLinkCopied(false);
    }
  }, [open]);

  // Load combined contacts: project members + connections
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    setLoadingContacts(true);
    (async () => {
      try {
        const ids = new Set<string>();

        if (callContext.projectId) {
          const { data: collabs } = await supabase
            .from("project_collaborators")
            .select("user_id")
            .eq("project_id", callContext.projectId)
            .eq("status", "accepted");
          (collabs || []).forEach((c) => c.user_id && ids.add(c.user_id));
        }

        const { data: conns } = await supabase
          .from("connections")
          .select("user_id, connected_user_id")
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted");
        (conns || []).forEach((c) => {
          ids.add(c.user_id === user.id ? c.connected_user_id : c.user_id);
        });
        ids.delete(user.id);

        if (!ids.size) {
          if (!cancelled) setContacts([]);
          return;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .in("user_id", Array.from(ids))
          .limit(200);

        if (!cancelled) {
          setContacts(
            (profiles || []).sort((a, b) =>
              (a.full_name || "").localeCompare(b.full_name || ""),
            ),
          );
        }
      } catch (e) {
        console.warn("[CallInviteSheet] contacts", e);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    })().catch(() => setLoadingContacts(false));
    return () => {
      cancelled = true;
    };
  }, [open, user?.id, callContext.projectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((p) =>
      (p.full_name || "").toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const toggleSelect = (p: Person) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.user_id)) next.delete(p.user_id);
      else next.set(p.user_id, p);
      return next;
    });
  };

  const handleRing = async () => {
    if (selected.size === 0 || !user?.id) return;
    setRinging(true);
    try {
      await ringUsers(Array.from(selected.keys()), {
        kind: callContext.kind,
        projectId: callContext.projectId ?? undefined,
        projectName: callContext.projectName,
        callerId: user.id,
        callerName: callContext.callerName,
        callerAvatar: callContext.callerAvatar ?? null,
        roomUrl: callContext.roomUrl,
        roomName: callContext.roomName,
        callId: callContext.callId ?? null,
      });
      toast({
        title: `Ringing ${selected.size} ${selected.size === 1 ? "person" : "people"}…`,
        description: "They'll see an incoming call card.",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't ring",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setRinging(false);
    }
  };

  const buildShareUrl = async (): Promise<string> => {
    if (callContext.meetingShareUrl) return callContext.meetingShareUrl;
    const { data, error } = await supabase.functions.invoke(
      "create-video-guest-link",
      {
        body: {
          project_id: callContext.projectId ?? null,
          direct_call_id: callContext.directCallId ?? null,
          room_name: callContext.roomName,
          room_url: callContext.roomUrl,
          guest_label: callContext.projectName,
        },
      },
    );
    if (error) throw error;
    return `${APP_URL}/call/${data.token}`;
  };

  const handleShareLink = async () => {
    setGeneratingLink(true);
    try {
      const url = await buildShareUrl();
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Join "${callContext.projectName}" on Kretopia`,
            text: `${callContext.callerName} is inviting you to a video call`,
            url,
          });
          toast({ title: "Invite shared" });
          return;
        } catch {
          /* user cancelled — fall through to clipboard */
        }
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({
        title: "Invite link copied",
        description: callContext.meetingShareUrl
          ? "Anyone with this link can join."
          : "Valid for 4 hours — paste it anywhere.",
      });
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (e: any) {
      toast({
        title: "Couldn't create link",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    setGeneratingLink(true);
    try {
      const url = await buildShareUrl();
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({ title: "Invite link copied" });
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (e: any) {
      toast({
        title: "Couldn't copy link",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88dvh] p-0 flex flex-col bg-background gap-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0 text-left">
          <SheetTitle className="text-base font-semibold">Invite to call</SheetTitle>
          <p className="text-xs text-muted-foreground truncate">
            {callContext.projectName}
          </p>
        </SheetHeader>

        {/* OPTION 1 — Send a link */}
        <div className="px-4 py-4 border-b border-border shrink-0 space-y-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            Send a link
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleShareLink}
              disabled={generatingLink}
              className="flex-1 h-11 rounded-full gap-2"
            >
              {generatingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : canShare ? (
                <Share2 className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              <span className="font-medium">
                {canShare ? "Share invite link" : "Copy invite link"}
              </span>
            </Button>
            {canShare && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                disabled={generatingLink}
                className="h-11 px-4 rounded-full"
                aria-label="Copy link"
              >
                {linkCopied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Anyone with the link can join — perfect for clients, friends, or guests.
          </p>
        </div>

        {/* OPTION 2 — From contacts */}
        <div className="px-4 pt-4 pb-2 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              From contacts
            </p>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Map())}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear ({selected.size})
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your contacts…"
              className="pl-9 rounded-full h-10"
            />
          </div>
        </div>

        {/* Contacts list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingContacts ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 text-muted-foreground gap-2 py-10">
              <Users className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {contacts.length === 0
                  ? "No contacts yet — use the link above to invite anyone."
                  : "No matches for that name."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => {
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

        {/* Ring button */}
        {selected.size > 0 && (
          <div
            className="px-4 pt-3 border-t border-border shrink-0 bg-background"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <Button
              type="button"
              onClick={handleRing}
              disabled={ringing}
              className="w-full h-12 rounded-full gap-2 text-base font-semibold"
            >
              {ringing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              Ring {selected.size} {selected.size === 1 ? "person" : "people"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
