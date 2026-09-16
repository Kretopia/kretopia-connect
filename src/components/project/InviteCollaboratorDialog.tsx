import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserPlus, Mail, Loader2, Users, Briefcase, Sparkles, Handshake, Link2, Copy, Check, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getShareUrl } from "@/lib/constants";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const extractEmails = (text: string): string[] => {
  const matches = text.match(EMAIL_RE) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const v = m.toLowerCase();
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
};

interface InviteCollaboratorDialogProps {
  projectId: string;
  onInvite: () => void;
}

type InviteRole = "client" | "creative" | "collaborator";

const ROLE_OPTIONS: { value: InviteRole; label: string; description: string; icon: typeof Briefcase }[] = [
  { value: "creative", label: "Creative", description: "Doing the work", icon: Sparkles },
  { value: "client", label: "Client", description: "Paying / approving", icon: Briefcase },
  { value: "collaborator", label: "Collaborator", description: "Helping out", icon: Handshake },
];

export const InviteCollaboratorDialog = ({ projectId, onInvite }: InviteCollaboratorDialogProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<InviteRole>("creative");
  const { toast } = useToast();

  // Filter connected users based on search
  const filteredConnections = connectedUsers.filter((user) =>
    user.full_name.toLowerCase().includes(searchInput.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchInput.toLowerCase())
  );

  // Detect emails in input (supports paste of comma/space/newline separated lists)
  const parsedEmails = extractEmails(searchInput);
  const isEmailFormat = parsedEmails.length === 1 && /^\s*\S+@\S+\.\S+\s*$/.test(searchInput.trim());
  const isBulkEmails = parsedEmails.length > 1;

  // Load connected users when dialog opens
  useEffect(() => {
    if (open) {
      loadConnectedUsers();
    }
  }, [open]);

  const loadConnectedUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found for loading connections");
        return;
      }

      console.log("Loading connections for user:", user.id);

      // Get all accepted connections where user is the initiator
      const { data: outgoing, error: outgoingError } = await supabase
        .from("connections")
        .select("connected_user_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      console.log("Outgoing connections:", outgoing, outgoingError);

      // Get all accepted connections where user is the recipient
      const { data: incoming, error: incomingError } = await supabase
        .from("connections")
        .select("user_id")
        .eq("connected_user_id", user.id)
        .eq("status", "accepted");

      console.log("Incoming connections:", incoming, incomingError);

      // Get all matches
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq("status", "matched");

      console.log("Matches:", matches, matchesError);

      const connectedIds = new Set<string>();
      outgoing?.forEach((c) => connectedIds.add(c.connected_user_id));
      incoming?.forEach((c) => connectedIds.add(c.user_id));
      matches?.forEach((m) => {
        connectedIds.add(m.user1_id === user.id ? m.user2_id : m.user1_id);
      });

      // Remove current user from the set (in case of self-references)
      connectedIds.delete(user.id);

      console.log("Connected user IDs:", Array.from(connectedIds));

      if (connectedIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role, professional_skills")
          .in("user_id", Array.from(connectedIds));

        console.log("Loaded profiles:", profiles, profilesError);
        setConnectedUsers(profiles || []);
      } else {
        console.log("No connected IDs found");
        setConnectedUsers([]);
      }
    } catch (error) {
      console.error("Error loading connected users:", error);
    }
  };

  const handleInviteByEmail = async (emailToInvite: string) => {
    if (!emailToInvite) return;
    
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile for inviter name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Get project details
      const { data: project } = await supabase
        .from('projects')
        .select('title')
        .eq('id', projectId)
        .single();

      const { error } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          email: emailToInvite.toLowerCase(),
          invited_by: user.id,
          role: 'member',
          agent_role: selectedRole,
          status: 'pending'
        });

      if (error) throw error;

      // Send invitation email
      console.log('Invoking send-project-invitation function for:', emailToInvite);
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-project-invitation', {
        body: {
          email: emailToInvite.toLowerCase(),
          projectTitle: project?.title || 'Untitled Project',
          projectId,
          inviterName: profile?.full_name || 'A Kretopia user',
        }
      });

      if (emailError) {
        console.error('Edge function error:', emailError);
        throw new Error(`Failed to send email: ${emailError.message}`);
      }

      console.log('Email sent successfully:', emailData);

      toast({
        title: "Invite sent!",
        description: `Invitation sent to ${emailToInvite}`,
      });
      setSearchInput("");
      setOpen(false);
      onInvite();
    } catch (error: any) {
      console.error('Error inviting collaborator:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleBulkInviteByEmail = async (emails: string[]) => {
    if (!emails.length) return;
    setSending(true);
    let ok = 0;
    let fail = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
      const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();

      for (const email of emails) {
        try {
          const { error } = await supabase.from('project_collaborators').insert({
            project_id: projectId,
            email,
            invited_by: user.id,
            role: 'member',
            agent_role: selectedRole,
            status: 'pending',
          });
          if (error) throw error;
          await supabase.functions.invoke('send-project-invitation', {
            body: {
              email,
              projectTitle: project?.title || 'Untitled Project',
              projectId,
              inviterName: profile?.full_name || 'A Kretopia user',
            },
          }).catch((e) => console.warn('email send failed', email, e));
          ok++;
        } catch (e) {
          console.warn('bulk invite failed for', email, e);
          fail++;
        }
      }
      toast({
        title: `Sent ${ok} invite${ok === 1 ? '' : 's'}`,
        description: fail > 0 ? `${fail} couldn't be sent (already invited?)` : 'They\'ll get an email with the studio link.',
      });
      setSearchInput("");
      setOpen(false);
      onInvite();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleInviteUser = async (userId: string, userName: string) => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile for inviter name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Get project details
      const { data: project } = await supabase
        .from('projects')
        .select('title')
        .eq('id', projectId)
        .single();

      // Existing users are linked by user_id; email is optional
      const { error } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          user_id: userId,
          email: null,
          invited_by: user.id,
          role: 'member',
          agent_role: selectedRole,
          status: 'pending'
        });

      if (error) throw error;

      // Always send invitation notification for existing users
      console.log('Invoking send-project-invitation function for user:', userId);
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-project-invitation', {
        body: {
          projectTitle: project?.title || 'Untitled Project',
          projectId,
          inviterName: profile?.full_name || 'A Kretopia user',
          inviteeUserId: userId, // This triggers in-app notification
        }
      });

      if (emailError) {
        console.error('Edge function error:', emailError);
        // Don't throw for existing users - they got the in-app notification
        console.warn('Email notification failed but in-app notification was sent');
      } else {
        console.log('Notification sent successfully:', emailData);
      }

      toast({
        title: "Invite sent!",
        description: `${userName} has been invited to the project`,
      });
      setSearchInput("");
      setOpen(false);
      onInvite();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-4 sm:p-6 overflow-x-hidden">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base sm:text-lg">Invite to the Studio</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Bring in teammates, or share a guest link with a client.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="people" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="people" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> People
            </TabsTrigger>
            <TabsTrigger value="guest" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Guest link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guest" className="pt-3">
            <GuestLinkPanel projectId={projectId} />
          </TabsContent>

          <TabsContent value="people" className="pt-3">
        <div className="space-y-4">
          {/* Role picker */}
          <div className="space-y-2">
            <Label>Invite as</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = selectedRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className={cn(
                      "min-w-0 flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2.5 text-center transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xs font-medium truncate max-w-full">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search or Enter Email</Label>
            <div className="relative">
              <Input
                id="search"
                placeholder="Type name, role, or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pr-10"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[260px] sm:h-[300px] rounded-md border">
            {/* Show filtered circle connections */}
            {filteredConnections.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 flex items-center gap-2">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    From Your Circle
                  </span>
                </div>
                {filteredConnections.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors group"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                        {user.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.role}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInviteUser(user.user_id, user.full_name)}
                      disabled={sending}
                      variant="default"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Show email invite option if email format detected */}
            {isEmailFormat && filteredConnections.length === 0 && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Invite by email</span>
                </div>
                <div className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{searchInput}</p>
                    <p className="text-xs text-muted-foreground">Send invitation email</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleInviteByEmail(searchInput.trim())}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </Button>
                </div>
              </div>
            )}

            {/* Bulk email paste — 2+ emails detected */}
            {isBulkEmails && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{parsedEmails.length} emails detected</span>
                </div>
                <div className="rounded-lg border-2 border-dashed p-3 space-y-2 max-h-32 overflow-y-auto">
                  {parsedEmails.slice(0, 8).map((e) => (
                    <p key={e} className="text-xs font-mono text-muted-foreground truncate">{e}</p>
                  ))}
                  {parsedEmails.length > 8 && (
                    <p className="text-[10px] text-muted-foreground">+ {parsedEmails.length - 8} more</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => handleBulkInviteByEmail(parsedEmails)}
                  disabled={sending}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send {parsedEmails.length} invites
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Tip: paste from any spreadsheet or contact list — we'll pull out every valid email.
                </p>
              </div>
            )}

            {/* Empty states */}
            {!searchInput && connectedUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No connections yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter an email to invite someone
                </p>
              </div>
            )}

            {!searchInput && connectedUsers.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 flex items-center gap-2">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Your Circle ({connectedUsers.length})
                  </span>
                </div>
                {connectedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                        {user.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.role}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInviteUser(user.user_id, user.full_name)}
                      disabled={sending}
                      variant="default"
                    >
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchInput && filteredConnections.length === 0 && !isEmailFormat && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No matches found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try entering an email address to invite them
                </p>
              </div>
            )}
          </ScrollArea>
          </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Guest link panel — mints a shareable /guest/:token URL for clients
// ---------------------------------------------------------------------------

const GuestLinkPanel = ({ projectId }: { projectId: string }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("guest_studio_tokens")
          .select("token")
          .eq("project_id", projectId)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (active && data?.token) setToken(data.token);
      } catch (e) {
        console.warn("[guest link] load", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const create = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("guest_studio_tokens")
        .insert({ project_id: projectId, created_by: user.id })
        .select("token")
        .single();
      if (error) throw error;
      setToken(data.token);
      toast({ title: "Guest link ready" });
    } catch (e: any) {
      toast({ title: "Couldn't create link", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const url = token ? getShareUrl(`/guest/${encodeURIComponent(token)}`) : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", description: "Long-press to copy manually", variant: "destructive" });
    }
  };

  const share = async () => {
    if (!url) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Join my Studio on Kretopia", text: "I'm bringing you into a studio — tap to see the brief, vault & chat.", url });
        return;
      } catch { /* user cancelled */ }
    }
    copy();
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 p-3 space-y-1">
        <p className="text-xs font-bold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Magic-link access
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Anyone with this link gets a guest Studio — Brief, Vault & Chat.
          No password, no signup needed. They'll see a "Claim your profile" button.
        </p>
      </div>

      {token ? (
        <div className="space-y-2">
          <Label className="text-xs">Share this link</Label>
          <div className="flex gap-2 min-w-0">
            <Input readOnly value={url} className="font-mono text-xs min-w-0 flex-1 truncate" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" onClick={copy} className="shrink-0 gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={share}>
              <Share2 className="h-3.5 w-3.5" />
              Share link
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-8" onClick={create} disabled={creating}>
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "New link"}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={create} disabled={creating} className="w-full gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create guest link
        </Button>
      )}
    </div>
  );
};
