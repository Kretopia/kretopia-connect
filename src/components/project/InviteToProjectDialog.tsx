import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Briefcase, Sparkles, Handshake, FolderKanban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface InviteToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientUserId: string;
  recipientName: string;
}

type InviteRole = "client" | "creative" | "collaborator";

const ROLE_OPTIONS: { value: InviteRole; label: string; description: string; icon: typeof Briefcase }[] = [
  { value: "creative", label: "Creative", description: "Doing the work", icon: Sparkles },
  { value: "client", label: "Client", description: "Paying / approving", icon: Briefcase },
  { value: "collaborator", label: "Collaborator", description: "Helping out", icon: Handshake },
];

export const InviteToProjectDialog = ({
  open,
  onOpenChange,
  recipientUserId,
  recipientName,
}: InviteToProjectDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<InviteRole>("creative");
  const [sending, setSending] = useState(false);
  const [existingProjectIds, setExistingProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const sb = supabase as any;
        const ownedRes: any = await sb
          .from("projects")
          .select("id, title, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        const collabRes: any = await sb
          .from("project_collaborators")
          .select("project_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        const owned: any[] = ownedRes.data || [];
        const ownedIds = new Set<string>(owned.map((p) => p.id));
        const collabIds: string[] = (collabRes.data || [])
          .map((r: any) => r.project_id)
          .filter((id: string) => id && !ownedIds.has(id));

        let collabProjects: any[] = [];
        if (collabIds.length > 0) {
          const cp: any = await sb
            .from("projects")
            .select("id, title, status, created_at")
            .in("id", collabIds);
          collabProjects = cp.data || [];
        }
        const merged: any[] = [...owned, ...collabProjects];

        const projectIds = merged.map((p) => p.id);
        let existing = new Set<string>();
        if (projectIds.length > 0) {
          const { data: rows } = await sb
            .from("project_collaborators")
            .select("project_id, status")
            .eq("user_id", recipientUserId)
            .in("project_id", projectIds);
          existing = new Set(((rows || []) as any[]).map((r) => r.project_id));
        }

        if (!cancelled) {
          setProjects(merged);
          setExistingProjectIds(existing);
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch((e) => console.error(e));

    return () => { cancelled = true; };
  }, [open, user?.id, recipientUserId]);

  const availableProjects = useMemo(
    () => projects.filter((p) => !existingProjectIds.has(p.id)),
    [projects, existingProjectIds]
  );

  const handleSend = async () => {
    if (!user || !selectedProjectId) return;
    setSending(true);
    try {
      const project = projects.find((p) => p.id === selectedProjectId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("project_collaborators").insert({
        project_id: selectedProjectId,
        user_id: recipientUserId,
        email: null,
        invited_by: user.id,
        role: "member",
        agent_role: selectedRole,
        status: "pending",
      });

      if (error) throw error;

      await supabase.functions
        .invoke("send-project-invitation", {
          body: {
            projectTitle: project?.title || "Untitled Project",
            projectId: selectedProjectId,
            inviterName: profile?.full_name || "A Kretopia user",
            inviteeUserId: recipientUserId,
          },
        })
        .catch((e) => console.warn("Invitation function failed (non-fatal)", e));

      toast({
        title: "Invite sent!",
        description: `${recipientName} was invited to "${project?.title || "your project"}" as ${selectedRole}.`,
      });
      onOpenChange(false);
      setSelectedProjectId(null);
      setSelectedRole("creative");
    } catch (e: any) {
      toast({
        title: "Couldn't send invite",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {recipientName} to a project</DialogTitle>
          <DialogDescription>
            Pick one of your projects and the role they'll play.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Invite as</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = selectedRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            <ScrollArea className="h-[260px] rounded-md border">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <FolderKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">No eligible projects</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {projects.length === 0
                      ? "Create a project first, then invite collaborators."
                      : `${recipientName} is already on all your projects.`}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {availableProjects.map((p) => {
                    const active = selectedProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProjectId(p.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                          active ? "bg-primary/10 border border-primary" : "hover:bg-accent border border-transparent"
                        )}
                      >
                        <FolderKanban className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.title || "Untitled"}</p>
                          {p.status && (
                            <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                          )}
                        </div>
                        {active && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSend}
              disabled={!selectedProjectId || sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
