import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Send, ArrowLeft, MoreVertical, Briefcase, Users, Crown, Loader2, Trash2, Share2, Link2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import type { GroupRoom } from "./GroupsList";
import { getShareUrl } from "@/lib/constants";

interface GroupMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  message_type: string;
}

interface MemberProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface GroupChatPanelProps {
  group: GroupRoom;
  currentUserId: string;
  onBack: () => void;
}

export const GroupChatPanel = ({ group, currentUserId, onBack }: GroupChatPanelProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscriptionInfo } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<Record<string, MemberProfile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const isOwner = group.created_by === currentUserId;
  const isCreatorTier = subscriptionInfo?.subscribed && (subscriptionInfo.tier === "pro" || subscriptionInfo.tier === "creator" || subscriptionInfo.tier === "creator_plus");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [msgRes, memRes] = await Promise.all([
        supabase
          .from("spark_room_messages")
          .select("id,user_id,content,created_at,message_type")
          .eq("room_id", group.id)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase.from("spark_room_members").select("user_id").eq("room_id", group.id),
      ]);
      if (!mounted) return;
      setMessages((msgRes.data as GroupMessage[]) || []);
      const ids = (memRes.data || []).map((m) => m.user_id);
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", ids);
        const map: Record<string, MemberProfile> = {};
        (profs || []).forEach((p) => (map[p.user_id] = p));
        setMembers(map);
      }
    };
    load();

    const channel = supabase
      .channel(`group-chat-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spark_room_messages", filter: `room_id=eq.${group.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as GroupMessage]);
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [group.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await supabase.from("spark_room_messages").insert({
      room_id: group.id,
      user_id: currentUserId,
      content: newMessage.trim(),
      message_type: "text",
    });
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
    }
    setSending(false);
  };

  const turnIntoProject = async () => {
    if (!isOwner) {
      toast({ title: "Only the group creator can do this", variant: "destructive" });
      return;
    }
    if (!isCreatorTier) {
      toast({
        title: "Upgrade to Creator",
        description: "Promoting a group to a Project is a Creator-tier feature.",
      });
      navigate("/pricing");
      return;
    }
    setPromoting(true);
    try {
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("spark_room_id", group.id)
        .maybeSingle();
      if (existing) {
        navigate(`/desk/${existing.id}`);
        return;
      }
      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          title: group.title,
          created_by: currentUserId,
          spark_room_id: group.id,
          status: "active",
          description: `Promoted from group chat "${group.title}"`,
        })
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Project created", description: "Your group is now a project workspace." });
      navigate(`/desk/${proj.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't create project", description: e.message, variant: "destructive" });
    } finally {
      setPromoting(false);
    }
  };

  const shareInvite = async () => {
    if (!group.invite_code) {
      toast({ title: "No invite link available", variant: "destructive" });
      return;
    }
    const url = getShareUrl(`/messages?groupInvite=${group.invite_code}`);
    const shareData = {
      title: `Join "${group.title}" on Kretopia`,
      text: `You're invited to join the "${group.title}" group chat on Kretopia.`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Invite link copied", description: url });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(url);
          toast({ title: "Invite link copied", description: url });
        } catch {
          toast({ title: "Couldn't share", description: e.message, variant: "destructive" });
        }
      }
    }
  };

  const copyInviteLink = async () => {
    if (!group.invite_code) {
      toast({ title: "No invite link available", variant: "destructive" });
      return;
    }
    const url = getShareUrl(`/messages?groupInvite=${group.invite_code}`);
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  const deleteGroup = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_group_room", { _room_id: group.id });
    setDeleting(false);
    if (error) {
      toast({ title: "Couldn't delete group", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Group deleted" });
    setConfirmDelete(false);
    onBack();
  };

  const memberList = Object.values(members);

  return (
    <div className="flex-1 flex flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-24">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border flex items-center gap-2.5 sm:gap-3 bg-card">
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9 sm:h-11 sm:w-11 border-2 border-background">
          <AvatarFallback className="text-base bg-primary/15 text-primary">
            {group.icon_emoji || group.title.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{group.title}</h3>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {group.member_count} members
            {group.circle_type === "event" && (
              <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">From event</Badge>
            )}
          </p>
        </div>

        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex gap-2"
            onClick={turnIntoProject}
            disabled={promoting}
          >
            {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Turn into Project
            {!isCreatorTier && <Crown className="h-3 w-3 text-energy" />}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <>
                <DropdownMenuItem onClick={turnIntoProject} className="sm:hidden">
                  <Briefcase className="h-4 w-4 mr-2" /> Turn into Project
                  {!isCreatorTier && <Crown className="h-3 w-3 ml-auto text-energy" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
              </>
            )}
            <DropdownMenuItem onClick={shareInvite}>
              <Share2 className="h-4 w-4 mr-2" /> Share invite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyInviteLink}>
              <Link2 className="h-4 w-4 mr-2" /> Copy invite link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {memberList.length} members
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete group
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{group.title}", all of its messages and member list. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteGroup();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members strip */}
      {memberList.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-border bg-card/40 overflow-x-auto">
          {memberList.slice(0, 8).map((m) => (
            <Avatar key={m.user_id} className="h-7 w-7 border-2 border-background flex-shrink-0">
              <AvatarImage src={m.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">{(m.full_name || "U").charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
          {memberList.length > 8 && (
            <span className="text-xs text-muted-foreground ml-1">+{memberList.length - 8}</span>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-semibold mb-1">Say hi to the group</p>
              <p className="text-xs text-muted-foreground">Messages here are visible to all {group.member_count} members.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.user_id === currentUserId;
              const author = members[msg.user_id];
              return (
                <div key={msg.id} className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                  {!isOwn && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={author?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {(author?.full_name || "U").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                    {!isOwn && (
                      <p className="text-[11px] text-muted-foreground mb-0.5 px-1">
                        {author?.full_name || "Unknown"}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-1">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true }).replace("about ", "")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="p-3 sm:p-4 border-t border-border bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${group.title}…`}
            disabled={sending}
            className="rounded-full"
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};
