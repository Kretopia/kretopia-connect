import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Hand, Clock, Link2, Share2, Loader2 } from "lucide-react";
import { InviteCollaboratorDialog } from "@/components/project/InviteCollaboratorDialog";
import { GuestStudioShareDialog } from "@/components/project/GuestStudioShareDialog";
import { PendingInvitations } from "@/components/project/PendingInvitations";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getShareUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PeopleSectionProps {
  collaborators: Array<{ id: string; full_name: string; avatar_url: string | null; role: string | null }>;
  ownerUserId: string;
  currentUserId: string;
  isOwner: boolean;
  projectId: string;
  onUpdated: () => void;
  onlineUserIds?: Set<string>;
  onKnock?: (toUserId: string, toName: string) => void | Promise<void>;
}

interface PendingPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  isGuest: boolean;
}

export const PeopleSection = ({
  collaborators,
  ownerUserId,
  currentUserId,
  isOwner,
  projectId,
  onUpdated,
  onlineUserIds,
  onKnock,
}: PeopleSectionProps) => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingPerson[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [quickSharing, setQuickSharing] = useState(false);
  const { toast } = useToast();

  const quickShareGuestLink = async () => {
    setQuickSharing(true);
    try {
      const { data: existing } = await supabase
        .from("guest_studio_tokens")
        .select("token")
        .eq("project_id", projectId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let token = existing?.token as string | undefined;
      if (!token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const { data: created, error } = await supabase
          .from("guest_studio_tokens")
          .insert({ project_id: projectId, created_by: user.id })
          .select("token")
          .single();
        if (error) throw error;
        token = created.token;
      }

      const url = getShareUrl(`/guest/${encodeURIComponent(token)}`);
      const title = projectTitle || "my Studio";
      const shareText =
`You're invited to "${title}" on Kretopia 🎬

I've set up a private Studio for this project — brief, files, references and chat all in one place.

Tap the link, drop your name + email, and you're in. No password, no app to download.

${url}`;
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        try {
          await nav.share({
            title: `Join "${title}" on Kretopia`,
            text: shareText,
            url,
          });
          return;
        } catch { /* user cancelled — fall through to copy */ }
      }
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Invite copied", description: "Paste it into WhatsApp, iMessage or email — they're one tap from the Studio." });
    } catch (e: any) {
      toast({ title: "Couldn't share link", description: e.message, variant: "destructive" });
    } finally {
      setQuickSharing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("projects")
          .select("title")
          .eq("id", projectId)
          .maybeSingle();
        setProjectTitle(data?.title ?? "");
      } catch {/* ignore */}
    })();
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("id, user_id, email")
        .eq("project_id", projectId)
        .eq("status", "pending");
      if (error || !data || cancelled) return;

      const userIds = data.map((d) => d.user_id).filter(Boolean) as string[];
      let profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("public_profiles_safe")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profileMap = new Map(
          (profiles || []).map((p) => [p.user_id, { full_name: p.full_name || "Member", avatar_url: p.avatar_url }]),
        );
      }

      const mapped: PendingPerson[] = data.map((d) => {
        if (d.user_id) {
          const p = profileMap.get(d.user_id);
          return {
            id: d.id,
            full_name: p?.full_name || "Pending member",
            avatar_url: p?.avatar_url || null,
            email: d.email,
            isGuest: false,
          };
        }
        return {
          id: d.id,
          full_name: d.email?.split("@")[0] || "Guest",
          avatar_url: null,
          email: d.email,
          isGuest: true,
        };
      });
      if (!cancelled) setPending(mapped);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, collaborators.length]);

  const onlineCount = collaborators.filter(
    (c) => c.id !== currentUserId && onlineUserIds?.has(c.id),
  ).length;

  return (
    <section className="px-4 py-5 space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
            The Crew
          </p>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black leading-none tracking-tight">
              The People
            </h2>
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--energy)/0.15)] ring-1 ring-[hsl(var(--energy)/0.35)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--energy))]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--energy))] opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))]" />
                </span>
                {onlineCount} live
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={quickShareGuestLink}
              disabled={quickSharing}
              title="Share guest link instantly"
            >
              {quickSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              Share link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={() => setShareOpen(true)}
              title="Guest link settings"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <InviteCollaboratorDialog projectId={projectId} onInvite={onUpdated} />
          </div>
        )}
      </header>
      <GuestStudioShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        projectTitle={projectTitle}
      />

      {isOwner && collaborators.length <= 1 && pending.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.05)] p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[hsl(var(--energy)/0.15)] flex items-center justify-center shrink-0">
            <span aria-hidden className="text-base">👋</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">It's just you in here</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Pull in your team, client or interns to get this rolling.
            </p>
          </div>
        </div>
      )}

      <div className="-mx-4 px-4 overflow-x-auto">
        <div className="flex gap-3 pb-1">
          {collaborators.map((c) => {
            const isMe = c.id === currentUserId;
            const isOnline = !isMe && (onlineUserIds?.has(c.id) ?? false);
            return (
              <div key={c.id} className="shrink-0 flex flex-col items-center gap-1.5 w-16 group">
                <button
                  type="button"
                  disabled={isMe}
                  onClick={() => navigate(`/messages?user=${c.id}`)}
                  className="relative"
                  aria-label={isMe ? "You" : `Message ${c.full_name}`}
                >
                  <Avatar
                    className={cn(
                      "h-14 w-14 ring-2 transition-all",
                      isOnline
                        ? "ring-[hsl(var(--energy))] shadow-[0_0_10px_hsl(var(--energy)/0.5)]"
                        : "ring-border group-enabled:group-hover:ring-primary",
                    )}
                  >
                    <AvatarImage src={c.avatar_url || undefined} />
                    <AvatarFallback className="text-sm font-semibold">
                      {c.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {c.id === ownerUserId && (
                    <Crown className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary fill-primary/30" />
                  )}
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-[hsl(var(--energy))] ring-2 ring-background" />
                  )}
                </button>

                <p className="text-[11px] font-medium text-center leading-tight line-clamp-1 max-w-full">
                  {isMe ? "You" : c.full_name.split(" ")[0]}
                </p>
                {c.role && (
                  <p className="text-[9px] text-muted-foreground leading-none line-clamp-1 max-w-full">
                    {c.role}
                  </p>
                )}

                {isOnline && onKnock && (
                  <button
                    type="button"
                    onClick={() => onKnock(c.id, c.full_name)}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--energy)/0.15)] hover:bg-[hsl(var(--energy)/0.25)] text-[hsl(var(--energy))] ring-1 ring-[hsl(var(--energy)/0.3)] px-2 py-0.5 text-[10px] font-bold transition-colors"
                    aria-label={`Knock ${c.full_name}`}
                  >
                    <Hand className="h-2.5 w-2.5" />
                    Knock
                  </button>
                )}
              </div>
            );
          })}

          {pending.map((p) => (
            <div key={p.id} className="shrink-0 flex flex-col items-center gap-1.5 w-16 opacity-70">
              <div className="relative">
                <Avatar className="h-14 w-14 ring-2 ring-dashed ring-muted-foreground/40 grayscale">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback className="text-sm font-semibold bg-muted">
                    {p.isGuest ? "✉" : p.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-0.5 rounded-full bg-muted ring-2 ring-background px-1 py-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
              </div>
              <p className="text-[11px] font-medium text-center leading-tight line-clamp-1 max-w-full">
                {p.full_name.split(" ")[0]}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Pending
              </p>
            </div>
          ))}
        </div>
      </div>
      {isOwner && <PendingInvitations projectId={projectId} />}
    </section>
  );
};
