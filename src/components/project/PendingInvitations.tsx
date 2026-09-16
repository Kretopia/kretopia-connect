import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, UserCheck, UserX, Clock, Users, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PendingInvitationsProps {
  projectId?: string;
  showAll?: boolean; // If true, show all pending invitations; if false, show only for specific project
}

export const PendingInvitations = ({ projectId, showAll = false }: PendingInvitationsProps) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvitations();
    
    // Real-time subscription
    const channel = supabase
      .channel('project-invitations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_collaborators',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, () => {
        fetchInvitations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('project_collaborators')
        .select(`
          *,
          projects!inner(id, title, description),
          inviter:profiles!invited_by(full_name, avatar_url),
          invitee:profiles!user_id(full_name, avatar_url)
        `)
        .eq('status', 'pending');

      if (!showAll && projectId) {
        query = query.eq('project_id', projectId);
      }

      // Show invitations sent by me or to me
      if (showAll) {
        query = query.or(`invited_by.eq.${user.id},user_id.eq.${user.id}`);
      } else {
        query = query.eq('invited_by', user.id);
      }

      const { data, error } = await query.order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });
      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRevokeEmailInvite = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('id', invitationId);
      if (error) throw error;
      toast({ title: "Invite revoked", description: "The email invite has been removed." });
      fetchInvitations();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleResendEmailInvite = async (invitation: any) => {
    if (!invitation.email || !invitation.projects?.id) return;
    setResendingId(invitation.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();
      const { error } = await supabase.functions.invoke('send-project-invitation', {
        body: {
          email: invitation.email,
          projectId: invitation.projects.id,
          projectTitle: invitation.projects.title || 'your Studio',
          inviterName: profile?.full_name || 'A teammate',
        },
      });
      if (error) throw error;
      toast({ title: "Invite resent", description: `Sent again to ${invitation.email}.` });
    } catch (e: any) {
      toast({ title: "Couldn't resend", description: e.message, variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show the card if there are no invitations
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Pending Invitations
          <Badge variant="secondary" className="ml-auto">{invitations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-auto max-h-[400px]">
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {invitation.invitee?.avatar_url ? (
                    <AvatarImage src={invitation.invitee.avatar_url} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary">
                      <Mail className="h-5 w-5" />
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {invitation.invitee?.full_name || invitation.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {invitation.projects?.title}
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
                  </p>

                  {invitation.user_id && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="h-7 text-xs"
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {!invitation.user_id && (
                    <div className="flex items-center gap-2 pt-2">
                      <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1">Waiting for email confirmation</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResendEmailInvite(invitation)}
                        disabled={resendingId === invitation.id}
                        className="h-7 text-xs"
                      >
                        {resendingId === invitation.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeEmailInvite(invitation.id)}
                        className="h-7 text-xs text-destructive hover:text-destructive"
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
