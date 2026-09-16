import { useEffect, useState } from "react";
import { ExternalLink, Check, X, Loader2, Sparkles, FileText, Award, Music, Newspaper } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Discovery {
  id: string;
  kind: "credit" | "press" | "award" | "upload";
  title: string;
  source_url: string;
  source_domain: string | null;
  thumbnail_url: string | null;
  excerpt: string | null;
  payload: any;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onRescan?: () => void;
  scanning?: boolean;
}

const KIND_META: Record<Discovery["kind"], { label: string; icon: any; color: string }> = {
  credit: { label: "Credit", icon: FileText, color: "bg-primary/15 text-primary border-primary/30" },
  press: { label: "Press", icon: Newspaper, color: "bg-accent/15 text-accent-foreground border-accent/30" },
  award: { label: "Award", icon: Award, color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  upload: { label: "Upload", icon: Music, color: "bg-fuchsia-500/15 text-fuchsia-500 border-fuchsia-500/30" },
};

export const PendingDiscoveriesDialog = ({ open, onOpenChange, onChanged, onRescan, scanning }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pending_discoveries")
      .select("id, kind, title, source_url, source_domain, thumbnail_url, excerpt, payload, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setItems((data || []) as Discovery[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, user]);

  const accept = async (item: Discovery) => {
    if (!user) return;
    setActingId(item.id);
    let undoData: { kind: string; insertedId?: string; prevSocialLinks?: any; prevPressLinks?: any } | null = null;
    try {
      // Dedupe check by source_url before inserting
      if (item.kind === "credit") {
        const { data: dup } = await supabase
          .from("credits")
          .select("id")
          .eq("user_id", user.id)
          .eq("url", item.source_url)
          .maybeSingle();
        if (dup) {
          await supabase.from("pending_discoveries").update({
            status: "accepted", reviewed_at: new Date().toISOString(),
          }).eq("id", item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          toast.info("Already in your credits — skipped");
          setActingId(null);
          return;
        }
        const { data: inserted } = await supabase.from("credits").insert({
          user_id: user.id,
          project_name: item.title,
          role: item.payload?.role || "Creator",
          source: item.source_domain || "web",
          url: item.source_url,
          verification_url: item.source_url,
          thumbnail_url: item.thumbnail_url,
          year: item.payload?.year || null,
          verification_status: "pending",
        } as any).select("id").maybeSingle();
        undoData = { kind: "credit", insertedId: inserted?.id };
      } else if (item.kind === "upload") {
        // An "upload" is a single piece of content (YouTube video, Vimeo, SoundCloud track, etc.).
        // Treat it as a CREDIT — that's what the user actually wants in their portfolio.
        // (Profile/channel ROOT URLs are filtered out by the classifier and live in Connected Platforms.)
        const { data: dup } = await supabase
          .from("credits")
          .select("id")
          .eq("user_id", user.id)
          .eq("url", item.source_url)
          .maybeSingle();
        if (dup) {
          await supabase.from("pending_discoveries").update({
            status: "accepted", reviewed_at: new Date().toISOString(),
          }).eq("id", item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          toast.info("Already in your credits — skipped");
          setActingId(null);
          return;
        }
        const { data: inserted, error: insertErr } = await supabase.from("credits").insert({
          user_id: user.id,
          project_name: item.title,
          role: item.payload?.role || "Creator",
          source: item.source_domain || "web",
          url: item.source_url,
          verification_url: item.source_url,
          thumbnail_url: item.thumbnail_url,
          year: item.payload?.year || null,
          verification_status: "pending",
        } as any).select("id").maybeSingle();
        if (insertErr) throw insertErr;
        undoData = { kind: "credit", insertedId: inserted?.id };
      } else if (item.kind === "award") {
        const { data: dup } = await supabase
          .from("awards")
          .select("id")
          .eq("user_id", user.id)
          .eq("verification_url", item.source_url)
          .maybeSingle();
        if (dup) {
          await supabase.from("pending_discoveries").update({
            status: "accepted", reviewed_at: new Date().toISOString(),
          }).eq("id", item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          toast.info("Already in your awards — skipped");
          setActingId(null);
          return;
        }
        const { data: inserted } = await supabase.from("awards").insert({
          user_id: user.id,
          title: item.title,
          organization: item.source_domain || "Unknown",
          verification_url: item.source_url,
          year: item.payload?.year || null,
        } as any).select("id").maybeSingle();
        undoData = { kind: "award", insertedId: inserted?.id };
      } else if (item.kind === "press") {
        const { data: prof } = await supabase
          .from("profiles")
          .select("press_links")
          .eq("user_id", user.id)
          .maybeSingle();
        const existing = Array.isArray((prof as any)?.press_links) ? (prof as any).press_links : [];
        if (existing.some((l: any) => l?.url === item.source_url)) {
          await supabase.from("pending_discoveries").update({
            status: "accepted", reviewed_at: new Date().toISOString(),
          }).eq("id", item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          toast.info("Already in your press — skipped");
          setActingId(null);
          return;
        }
        undoData = { kind: "press", prevPressLinks: existing };
        await supabase.from("profiles").update({
          press_links: [...existing, {
            url: item.source_url,
            title: item.title,
            outlet: item.source_domain,
            added_at: new Date().toISOString(),
          }],
        } as any).eq("user_id", user.id);
      }

      await supabase.from("pending_discoveries").update({
        status: "accepted", reviewed_at: new Date().toISOString(),
      }).eq("id", item.id);

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onChanged?.();

      const labelMap: Record<string, string> = {
        credit: "credits",
        upload: "linked profiles",
        award: "awards",
        press: "press",
      };
      toast.success(`Added to your ${labelMap[item.kind]}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (!undoData) return;
              if (undoData.kind === "credit" && undoData.insertedId) {
                await supabase.from("credits").delete().eq("id", undoData.insertedId);
              } else if (undoData.kind === "award" && undoData.insertedId) {
                await supabase.from("awards").delete().eq("id", undoData.insertedId);
              } else if (undoData.kind === "upload") {
                await supabase.from("profiles").update({
                  social_links: undoData.prevSocialLinks ?? [],
                } as any).eq("user_id", user.id);
              } else if (undoData.kind === "press") {
                await supabase.from("profiles").update({
                  press_links: undoData.prevPressLinks ?? [],
                } as any).eq("user_id", user.id);
              }
              await supabase.from("pending_discoveries").update({
                status: "pending", reviewed_at: null,
              }).eq("id", item.id);
              setItems((prev) => [item, ...prev]);
              onChanged?.();
              toast.success("Undone");
            } catch {
              toast.error("Could not undo");
            }
          },
        },
        duration: 6000,
      });
    } catch (e: any) {
      toast.error(e?.message || "Could not add");
    } finally {
      setActingId(null);
    }
  };

  const dismiss = async (item: Discovery) => {
    setActingId(item.id);
    try {
      await supabase.from("pending_discoveries").update({
        status: "dismissed", reviewed_at: new Date().toISOString(),
      }).eq("id", item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onChanged?.();
    } finally {
      setActingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full p-0 gap-0 max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">New finds across your universe</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            We searched the web for new credits, press, awards, and uploads.
            Approve what's yours — we ignore the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] sm:px-6 sm:pb-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No pending finds. You're all caught up</p>
              {onRescan && (
                <Button onClick={onRescan} disabled={scanning} size="sm" variant="outline" className="gap-2">
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Scan again
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {items.map((item) => {
                const Meta = KIND_META[item.kind];
                const Icon = Meta.icon;
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex gap-3">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="h-12 w-12 sm:h-14 sm:w-14 rounded object-cover flex-shrink-0 bg-muted"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${Meta.color}`}>
                            {Meta.label}
                          </Badge>
                          {item.source_domain && (
                            <span className="text-[11px] text-muted-foreground truncate min-w-0">
                              {item.source_domain}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-tight line-clamp-2 break-words">{item.title}</p>
                        {item.excerpt && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words">{item.excerpt}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 flex-1 sm:flex-none min-w-0"
                        onClick={() => accept(item)}
                        disabled={actingId === item.id}
                      >
                        {actingId === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Check className="h-3 w-3" />}
                        That's me
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-muted-foreground flex-1 sm:flex-none min-w-0"
                        onClick={() => dismiss(item)}
                        disabled={actingId === item.id}
                      >
                        <X className="h-3 w-3" />
                        Not me
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-muted-foreground sm:ml-auto"
                        asChild
                      >
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
