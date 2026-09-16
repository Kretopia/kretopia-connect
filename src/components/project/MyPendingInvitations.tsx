import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserCheck, UserX, Clock, Inbox, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

export const MyPendingInvitations = () => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchMyInvitations();
      
      // Real-time subscription
      const channel = supabase
        .channel('my-invitations')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'project_collaborators',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchMyInvitations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchMyInvitations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select(`
          *,
          projects!inner(id, title, description)
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;

      // Fetch inviter profiles separately
      const enrichedData = await Promise.all(
        (data || []).map(async (inv) => {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', inv.invited_by)
            .single();
          
          return {
            ...inv,
            inviter: inviterProfile
          };
        })
      );

      setInvitations(enrichedData);
    } catch (error: any) {
      console.error('Error fetching my invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string, projectId: string) => {
    setProcessingId(invitationId);
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation accepted!",
        description: "You've joined the project",
      });
      
      // Navigate to the project
      navigate(`/desk/${projectId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation declined",
        description: "You've declined the project invitation",
      });
      
      fetchMyInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl glass-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-[hsl(var(--color-accent))]" />
        <h3 className="text-lg font-semibold">Project Invitations</h3>
        <Badge className="ml-auto">{invitations.length}</Badge>
      </div>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex flex-col gap-3 p-4 rounded-lg border border-white/10 bg-white/[0.02]"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={invitation.inviter?.avatar_url} />
                <AvatarFallback>
                  {invitation.inviter?.full_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-sm">
                  {invitation.inviter?.full_name || 'Someone'} invited you to collaborate
                </p>
                <p className="text-sm font-semibold text-primary truncate">
                  {invitation.projects?.title}
                </p>
                {invitation.agent_role && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    Role: {invitation.agent_role === 'member' ? 'Collaborator' : invitation.agent_role}
                  </Badge>
                )}
                {invitation.projects?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {invitation.projects.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAccept(invitation.id, invitation.project_id)}
                disabled={processingId === invitation.id}
                className="flex-1"
              >
                {processingId === invitation.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(invitation.id)}
                disabled={processingId === invitation.id}
                className="flex-1"
              >
                <UserX className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};