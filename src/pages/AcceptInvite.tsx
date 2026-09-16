import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ProjectPreview {
  title: string;
  workspace_type: string | null;
  mood: string | null;
  inviter_name: string | null;
  collaborator_count: number;
}

const AcceptInvite = () => {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [preview, setPreview] = useState<ProjectPreview | null>(null);
  const email = searchParams.get("email");

  // Fetch lightweight project preview for OG tags + on-screen share card
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: project } = await supabase
          .from("projects")
          .select("title, workspace_type, mood, created_by")
          .eq("id", projectId)
          .maybeSingle();
        if (!project || cancelled) return;

        const [inviterRes, countRes] = await Promise.all([
          project.created_by
            ? supabase.from("public_profiles_safe").select("full_name").eq("user_id", project.created_by).maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabase
            .from("project_collaborators")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("status", "accepted"),
        ]);
        if (cancelled) return;
        setPreview({
          title: project.title || "Untitled project",
          workspace_type: project.workspace_type,
          mood: project.mood,
          inviter_name: (inviterRes as any)?.data?.full_name || null,
          collaborator_count: (countRes as any)?.count || 0,
        });
      } catch (err) {
        console.warn("preview fetch failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    const processInvitation = async () => {
      try {
        // If not authenticated: try to mint/look-up a guest preview token so the
        // user can open the workspace immediately without signing up.
        if (!user) {
          if (email && projectId) {
            try {
              const { data: token } = await supabase.rpc(
                "get_or_create_guest_token_for_invite",
                { _project_id: projectId, _email: email },
              );
              if (token) {
                navigate(`/guest/${encodeURIComponent(token as string)}`, { replace: true });
                return;
              }
            } catch (e) {
              console.warn("guest token lookup failed", e);
            }
          }
          const qs = email ? `?email=${encodeURIComponent(email)}` : '';
          const currentUrl = `/accept-invite/${projectId}${qs}`;
          navigate(`/auth?redirect=${encodeURIComponent(currentUrl)}`);
          return;
        }

        // Legacy placeholder format (kept for backward compatibility with old notifications)
        const isLegacyUserInvite = email?.startsWith('user-') && email?.endsWith('@platform.invite');
        const legacyInvitedUserId = isLegacyUserInvite
          ? email!.replace('user-', '').replace('@platform.invite', '')
          : null;

        if (legacyInvitedUserId && user.id !== legacyInvitedUserId) {
          toast({
            title: "Wrong account",
            description: "Please log in with the account that received the invitation.",
            variant: "destructive",
          });
          navigate("/circle");
          return;
        }

        // Look up the invitation. Prefer matching by user_id (new flow); fall back to email.
        let invitationQuery = supabase
          .from('project_collaborators')
          .select('*')
          .eq('project_id', projectId);

        if (email && !isLegacyUserInvite) {
          // Email-based invite: match by either user_id or email
          invitationQuery = invitationQuery.or(`user_id.eq.${user.id},email.eq.${escapePostgrestValue(email.toLowerCase())}`);
        } else {
          // In-app invite (no email param OR legacy placeholder): match by user_id
          invitationQuery = invitationQuery.eq('user_id', user.id);
        }

        const { data: invitation, error: inviteError } = await invitationQuery.maybeSingle();

        if (inviteError) throw inviteError;

        if (invitation) {
          if (invitation.status === 'pending') {
            const { error: updateError } = await supabase
              .from('project_collaborators')
              .update({
                status: 'accepted',
                user_id: user.id,
                accepted_at: new Date().toISOString(),
              })
              .eq('id', invitation.id);

            if (updateError) throw updateError;

            // Notify the inviter (owner) that the email invite was accepted
            if (invitation.invited_by && invitation.invited_by !== user.id) {
              const [{ data: projectRow }, { data: joiner }] = await Promise.all([
                supabase.from("projects").select("title").eq("id", projectId).maybeSingle(),
                supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
              ]);
              await supabase.from("notifications").insert({
                user_id: invitation.invited_by,
                type: "project_invite_accepted",
                title: "Invite accepted",
                message: `${joiner?.full_name || "Your invitee"} joined "${projectRow?.title || "your Studio"}".`,
                action_url: `/desk/${projectId}`,
                metadata: { project_id: projectId, joined_user_id: user.id },
              }).then(() => {}, () => {});
            }

            toast({
              title: "Welcome to the project!",
              description: "You've successfully joined the project team.",
            });
          } else {
            toast({
              title: "Already a member",
              description: "You're already part of this project.",
            });
          }
        } else {
          // Check if user already has access
          const { data: existingAccess } = await supabase
            .from('project_collaborators')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .eq('status', 'accepted')
            .maybeSingle();

          if (!existingAccess) {
            toast({
              title: "Invitation not found",
              description: "This invitation may have expired or been used already.",
              variant: "destructive",
            });
          }
        }

        // Redirect to project
        navigate(`/desk/${projectId}`);
      } catch (error: any) {
        console.error("Error processing invitation:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to process invitation",
          variant: "destructive",
        });
        navigate("/circle");
      } finally {
        setProcessing(false);
      }
    };

    if (projectId) {
      processInvitation();
    } else {
      toast({
        title: "Invalid invitation",
        description: "Missing required information",
        variant: "destructive",
      });
      navigate("/circle");
    }
  }, [user, loading, projectId, email, navigate, toast]);

  const ogImage = projectId
    ? `${SUPABASE_URL}/functions/v1/project-og-image?project_id=${projectId}`
    : undefined;
  const seoTitle = preview
    ? `${preview.inviter_name ? preview.inviter_name + " invited you to " : "You're invited to "}${preview.title} · Studios`
    : "You're invited to collaborate · Studios";
  const seoDesc = preview
    ? `Join ${preview.title} on Kretopia — collaborate on briefs, tasks, files, and payments in one creative workspace.`
    : "Open your invite to join the project workspace on Kretopia.";

  return (
    <>
      <SEO title={seoTitle} description={seoDesc} image={ogImage} type="website" />
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          {/* Share-card preview */}
          {preview ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl mb-6">
              <div className="aspect-[1200/630] bg-gradient-to-br from-primary/30 via-primary/15 to-accent/20 relative flex flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">Kretopia</p>
                    <p className="text-[10px] font-semibold text-primary">
                      Studios · {preview.workspace_type ? preview.workspace_type.replace("_", " ") : "Project"}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold px-3 py-1.5">
                    Join Studio →
                  </div>
                </div>
                <div>
                  <p className="text-[10px] tracking-widest font-semibold text-muted-foreground mb-1">
                    YOU'RE INVITED TO COLLABORATE
                  </p>
                  <h2 className="text-xl font-extrabold text-foreground leading-tight line-clamp-3">
                    {preview.title}
                  </h2>
                </div>
              </div>
              <div className="p-4 space-y-1.5">
                {preview.inviter_name && (
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Invited by <span className="font-semibold">{preview.inviter_name}</span>
                  </p>
                )}
                {preview.collaborator_count > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {preview.collaborator_count} {preview.collaborator_count === 1 ? "collaborator" : "collaborators"} on the project
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <h2 className="text-lg font-bold mb-1">Setting up your access…</h2>
            <p className="text-sm text-muted-foreground">Hang tight, we're opening the workspace.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AcceptInvite;
