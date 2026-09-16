import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Award, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMMON_ROLES = [
  "Creative Director", "Producer", "Videographer", "Editor",
  "Designer", "Photographer", "Sound Designer", "Model",
  "Stylist", "Writer", "Animator", "Music Producer",
  "Director", "Content Creator", "Brand Strategist",
];

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface RoleAssignment {
  userId: string;
  role: string;
}

interface ProjectCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  collaborators: Collaborator[];
  onCreditsAssigned?: () => void;
}

export const ProjectCreditsDialog = ({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  collaborators,
  onCreditsAssigned,
}: ProjectCreditsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<RoleAssignment[]>(
    collaborators.map((c) => ({ userId: c.id, role: "" }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateRole = (userId: string, role: string) => {
    setAssignments((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, role } : a))
    );
  };

  const selectSuggestedRole = (userId: string, role: string) => {
    const current = assignments.find((a) => a.userId === userId)?.role || "";
    // Toggle: if already selected, clear it; otherwise set it
    updateRole(userId, current === role ? "" : role);
  };

  const handleSubmit = async () => {
    if (!user) return;

    const validAssignments = assignments.filter((a) => a.role.trim());
    if (validAssignments.length === 0) {
      toast({ title: "Assign at least one role", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const inserts = validAssignments.map((a) => ({
        project_id: projectId,
        user_id: a.userId,
        role: a.role.trim(),
        assigned_by: user.id,
        // Auto-confirm the owner's own credit
        status: a.userId === user.id ? "confirmed" : "pending",
        confirmed_at: a.userId === user.id ? new Date().toISOString() : null,
      }));

      const { error } = await supabase.from("project_credits").insert(inserts);
      if (error) throw error;

      // Auto-create credit records for confirmed ones (owner)
      const ownerAssignment = validAssignments.find((a) => a.userId === user.id);
      if (ownerAssignment) {
        const { data: creditData } = await supabase
          .from("credits")
          .insert({
            user_id: user.id,
            project_name: projectTitle,
            role: ownerAssignment.role,
            year: new Date().getFullYear(),
            // Self-assigned by the project owner — honest tier is 'pending',
            // not 'verified'. A DB trigger also enforces this (see migration
            // 20260812120000_close_self_verification_rls_gaps.sql).
            verification_status: "pending",
          })
          .select("id")
          .single();

        if (creditData) {
          await supabase
            .from("project_credits")
            .update({ credit_id: creditData.id })
            .eq("project_id", projectId)
            .eq("user_id", user.id);
        }
      }

      // Send notifications to other collaborators
      const otherAssignments = validAssignments.filter((a) => a.userId !== user.id);
      for (const assignment of otherAssignments) {
          await supabase.from("notifications").insert({
          user_id: assignment.userId,
          title: "New Project Credit",
          message: `You've been credited as "${assignment.role}" on "${projectTitle}". Confirm to add it to your profile.`,
          type: "project_credit",
          link: `/desk/${projectId}`,
          action_url: `/desk/${projectId}`,
          action_text: "Confirm Credit",
          priority: "high",
          category: "project",
        });
      }

      setSubmitted(true);
      toast({
        title: "Credits assigned!",
        description: `${validAssignments.length} credit${validAssignments.length > 1 ? "s" : ""} assigned. Collaborators will be notified to confirm.`,
      });
      onCreditsAssigned?.();
      setTimeout(() => onOpenChange(false), 2000);
    } catch (error: any) {
      console.error("Error assigning credits:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign credits",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Assign Project Credits
          </DialogTitle>
          <DialogDescription>
            Assign roles to your team on "{projectTitle}". Credits will appear on their profiles as verified work history.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3"></div>
            <p className="font-semibold text-lg">Credits Assigned!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Collaborators will be notified to confirm their roles.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {collaborators.map((collab) => {
              const assignment = assignments.find((a) => a.userId === collab.id);
              const currentRole = assignment?.role || "";

              return (
                <div key={collab.id} className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={collab.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {collab.full_name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {collab.full_name}
                        {collab.id === user?.id && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                    </div>
                    {currentRole && (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                  </div>

                  <Input
                    placeholder="Type a role or pick below..."
                    value={currentRole}
                    onChange={(e) => updateRole(collab.id, e.target.value)}
                    className="h-9 text-sm"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_ROLES.slice(0, 8).map((role) => (
                      <Badge
                        key={role}
                        variant={currentRole === role ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          currentRole === role && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => selectSuggestedRole(collab.id, role)}
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!submitted && (
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !assignments.some((a) => a.role.trim())}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Assign Credits
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
