import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, UserX, Loader2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ProjectInviteAcceptBannerProps {
  projectId: string;
  onAccepted?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  client: "Client",
  creative: "Creative",
  collaborator: "Collaborator",
  manager: "Project Manager",
  member: "Collaborator",
};

export const ProjectInviteAcceptBanner = ({ projectId, onAccepted }: ProjectInviteAcceptBannerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invite, setInvite] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user || !projectId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("project_collaborators")
          .select("id, role, agent_role, invited_by, invited_at")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (cancelled || !data) {
          if (!cancelled) setInvite(null);
          return;
        }

        const { data: inviter } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("user_id", data.invited_by)
          .maybeSingle();

        if (!cancelled) setInvite({ ...data, inviter });
      } catch (e) {
        console.error("Failed to load invite", e);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id, projectId]);

  const handleAccept = async () => {
    if (!invite) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("project_collaborators")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      toast({ title: "You're in!", description: "Welcome to the project." });
      setInvite(null);
      onAccepted?.();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("project_collaborators")
        .update({ status: "rejected" })
        .eq("id", invite.id);
      if (error) throw error;
      toast({ title: "Invitation declined" });
      setInvite(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (!invite) return null;

  const roleLabel = ROLE_LABEL[invite.agent_role || invite.role] || "Collaborator";

  return (
    <div className="mx-3 sm:mx-4 mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={invite.inviter?.avatar_url} />
            <AvatarFallback>
              <Inbox className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {invite.inviter?.full_name || "Someone"} invited you to join this project
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                Role: {roleLabel}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 sm:flex-none"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCheck className="h-4 w-4 mr-1" />Accept</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecline}
            disabled={processing}
            className="flex-1 sm:flex-none"
          >
            <UserX className="h-4 w-4 mr-1" />
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
};
