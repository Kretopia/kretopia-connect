import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, Loader2, Check, Link2, Share2, MessageCircle } from "lucide-react";
import type { SharedContentType } from "./SharedContentCard";
import { getShareUrl } from "@/lib/constants";

interface ShareToMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentType: SharedContentType;
  contentId: string;
  contentMeta?: { title?: string; subtitle?: string; image_url?: string };
  /** Public URL for external sharing (WhatsApp, native share, copy). Optional. */
  externalUrl?: string;
  /** Optional override text for external share copy. */
  externalText?: string;
}

interface Connection {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const LABELS: Record<SharedContentType, string> = {
  gig: "gig",
  project: "project",
  event: "event",
  profile: "profile",
  credit: "credit",
  campaign: "campaign",
  stage: "Stage",
};

export const ShareToMessageDialog = ({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentMeta,
  externalUrl,
  externalText,
}: ShareToMessageDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setSelected(new Set());
    setNote("");
    setSearch("");
    (async () => {
      const [out, inc] = await Promise.all([
        supabase.from("connections").select("connected_user_id").eq("user_id", user.id).eq("status", "accepted"),
        supabase.from("connections").select("user_id").eq("connected_user_id", user.id).eq("status", "accepted"),
      ]);
      const ids = new Set<string>();
      out.data?.forEach((c) => ids.add(c.connected_user_id));
      inc.data?.forEach((c) => ids.add(c.user_id));
      if (ids.size === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", Array.from(ids));
      setConnections(data || []);
      setLoading(false);
    })();
  }, [open, user]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!user || selected.size === 0) return;
    setSending(true);
    try {
      // One row per recipient = sent separately (Instagram-style)
      const rows = Array.from(selected).map((receiver_id) => ({
        sender_id: user.id,
        receiver_id,
        content: note.trim() || `Shared a ${LABELS[contentType]}`,
        shared_content_type: contentType,
        shared_content_id: contentId,
        shared_content_meta: contentMeta || null,
        read: false,
      }));
      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;
      toast({ title: "Sent!", description: `Shared with ${selected.size} ${selected.size === 1 ? "person" : "people"}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not share", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(
    () => connections.filter((c) => (c.full_name || "").toLowerCase().includes(search.toLowerCase())),
    [connections, search]
  );

  // Top quick-share strip = first 12 (recent connections heuristic)
  const quickRow = useMemo(() => connections.slice(0, 12), [connections]);

  const buildExternalText = () => {
    const title = contentMeta?.title || `Check this ${LABELS[contentType]}`;
    const url = externalUrl || getShareUrl();
    return externalText || `${title}\n\n${url}`;
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildExternalText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareNative = async () => {
    const url = externalUrl || getShareUrl();
    const title = contentMeta?.title || `Kretopia ${LABELS[contentType]}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: buildExternalText(), url });
      } catch {
        // user cancelled
      }
    } else {
      copyLink();
    }
  };

  const copyLink = async () => {
    const url = externalUrl || getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Paste it anywhere." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-3 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full bg-muted border-none"
            />
          </div>
        </div>

        {/* Quick-share row (Instagram-style) */}
        {!loading && quickRow.length > 0 && !search && (
          <div className="px-6">
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {quickRow.map((c) => {
                  const isSel = selected.has(c.user_id);
                  return (
                    <button
                      key={c.user_id}
                      onClick={() => toggle(c.user_id)}
                      className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
                    >
                      <div className="relative">
                        <Avatar className={`h-14 w-14 transition-all ${isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback>{(c.full_name || "U")[0]}</AvatarFallback>
                        </Avatar>
                        {isSel && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-center truncate w-full leading-tight">
                        {(c.full_name || "User").split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Full list */}
        <ScrollArea className="flex-1 px-6 min-h-[180px]">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {connections.length === 0 ? "Connect with people to share with them." : "No matches"}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">Suggested</p>
              {filtered.map((c) => {
                const isSel = selected.has(c.user_id);
                return (
                  <button
                    key={c.user_id}
                    onClick={() => toggle(c.user_id)}
                    className={`flex items-center gap-3 w-full p-2 rounded-xl transition-colors ${
                      isSel ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={c.avatar_url || undefined} />
                      <AvatarFallback>{(c.full_name || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left text-sm font-medium truncate">{c.full_name || "Unknown"}</span>
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSel ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    >
                      {isSel && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Note + Send */}
        <div className="px-6 space-y-2">
          {selected.size > 0 && (
            <Input
              placeholder="Write a message…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-full bg-muted border-none"
            />
          )}
          <Button
            onClick={send}
            disabled={selected.size === 0 || sending}
            className="w-full gap-2 rounded-full"
            size="lg"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {selected.size === 0
              ? "Select people"
              : `Send separately to ${selected.size} ${selected.size === 1 ? "person" : "people"}`}
          </Button>
        </div>

        {/* External share row */}
        <div className="border-t px-6 py-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Share elsewhere</p>
          <div className="flex gap-2">
            <button
              onClick={shareWhatsApp}
              className="btn-glass btn-glass-outline flex-1 flex flex-col items-center gap-1 p-2 rounded-xl"
            >
              <div className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <span className="text-[11px]">WhatsApp</span>
            </button>
            <button
              onClick={shareNative}
              className="btn-glass btn-glass-outline flex-1 flex flex-col items-center gap-1 p-2 rounded-xl"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Share2 className="h-5 w-5" />
              </div>
              <span className="text-[11px]">More</span>
            </button>
            <button
              onClick={copyLink}
              className="btn-glass btn-glass-outline flex-1 flex flex-col items-center gap-1 p-2 rounded-xl"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <span className="text-[11px]">Copy link</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
