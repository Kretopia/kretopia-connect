import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Award, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ConfirmCreditBannerProps {
  projectId: string;
  projectTitle: string;
  onConfirmed?: () => void;
}

export const ConfirmCreditBanner = ({
  projectId,
  projectTitle,
  onConfirmed,
}: ConfirmCreditBannerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingCredit, setPendingCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("project_credits")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        setPendingCredit(data);
        setLoading(false);
      });
  }, [projectId, user]);

  const handleAction = async (action: "confirmed" | "declined") => {
    if (!user || !pendingCredit) return;
    setActing(true);

    try {
      await supabase
        .from("project_credits")
        .update({
          status: action,
          confirmed_at: action === "confirmed" ? new Date().toISOString() : null,
        })
        .eq("id", pendingCredit.id);

      if (action === "confirmed") {
        // Create the credit record on the user's profile
        const { data: creditData } = await supabase
          .from("credits")
          .insert({
            user_id: user.id,
            project_name: projectTitle,
            role: pendingCredit.role,
            year: new Date().getFullYear(),
            // Confirmed internally (owner assigned, collaborator accepted) —
            // real evidence, but not third-party/authoritative verification.
            // Honest tier is 'pending', enforced server-side by a DB trigger.
            verification_status: "pending",
          })
          .select("id")
          .single();

        if (creditData) {
          await supabase
            .from("project_credits")
            .update({ credit_id: creditData.id })
            .eq("id", pendingCredit.id);
        }

        toast({
          title: "Credit confirmed!",
          description: `"${pendingCredit.role}" on "${projectTitle}" added to your profile.`,
        });
      } else {
        toast({ title: "Credit declined" });
      }

      setPendingCredit(null);
      onConfirmed?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  if (loading || !pendingCredit) return null;

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <Award className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          You've been credited as <strong>{pendingCredit.role}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Confirm to add this to your profile
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction("declined")}
          disabled={acting}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => handleAction("confirmed")}
          disabled={acting}
        >
          {acting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Confirm
        </Button>
      </div>
    </div>
  );
};
