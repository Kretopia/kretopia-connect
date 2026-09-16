import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Desk → Pay handoff. When a project hits a "delivered/completed" status
 * and no invoice has been raised yet, surface a one-tap CTA to draft one.
 * Thrive Executive Producer voice — short, action-first.
 */
interface Props {
  project: { id: string; title?: string | null; status?: string | null; owner_id?: string | null };
}

const DONE_STATES = ["delivered", "completed", "done", "wrapped", "shipped"];

export const SendInvoiceNudge = ({ project }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !project?.id) return;
    if (project.owner_id && project.owner_id !== user.id) return;
    const status = (project.status || "").toLowerCase();
    if (!DONE_STATES.includes(status)) return;

    const key = `invoice-nudge-dismissed:${project.id}`;
    if (sessionStorage.getItem(key)) return;

    (async () => {
      const { data } = await (supabase as any)
        .from("invoices")
        .select("id")
        .eq("project_id", project.id)
        .limit(1)
        .maybeSingle()
        .then((r: any) => r, () => ({ data: null }));
      if (!data) setShow(true);
    })().catch(() => {});
  }, [user, project?.id, project?.status, project?.owner_id]);

  if (!show || dismissed) return null;

  return (
    <div className="mb-3 rounded-xl border border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.06)] p-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-[hsl(var(--energy)/0.15)] flex items-center justify-center shrink-0">
        <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--energy))" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Wrapped. Get paid.</p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
          Draft the invoice — pre-filled from this project.
        </p>
      </div>
      <Button
        size="sm"
        className="h-8"
        onClick={() => navigate(`/thrivepay?tab=invoices&new=1&project=${project.id}`)}
      >
        Draft <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(`invoice-nudge-dismissed:${project.id}`, "1");
          setDismissed(true);
        }}
        className="text-muted-foreground hover:text-foreground p-1"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
