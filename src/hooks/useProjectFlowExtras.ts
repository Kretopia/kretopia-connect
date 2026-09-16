import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight extra signals for the Project Flow timeline.
 * Kept out of useProjectData to avoid disrupting existing consumers.
 */
export interface FlowExtras {
  noteCount: number;
  approvalApprovedCount: number;
  approvalPendingCount: number;
  contractCount: number;
  contractSignedCount: number;
  invoiceCount: number;
  invoicePaidCount: number;
}

const empty: FlowExtras = {
  noteCount: 0,
  approvalApprovedCount: 0,
  approvalPendingCount: 0,
  contractCount: 0,
  contractSignedCount: 0,
  invoiceCount: 0,
  invoicePaidCount: 0,
};

export function useProjectFlowExtras(projectId: string | undefined, refreshKey?: unknown) {
  const [extras, setExtras] = useState<FlowExtras>(empty);

  useEffect(() => {
    if (!projectId) {
      setExtras(empty);
      return;
    }
    let cancelled = false;

    (async () => {
      const [notes, deliverables, contracts, invoices] = await Promise.all([
        supabase.from("project_notes").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("project_deliverables").select("id, status").eq("project_id", projectId),
        supabase.from("project_contracts").select("id, status").eq("project_id", projectId),
        supabase.from("invoices").select("id, status").eq("project_id", projectId),
      ]);

      if (cancelled) return;

      const dRows = (deliverables.data || []) as Array<{ status?: string | null }>;
      const cRows = (contracts.data || []) as Array<{ status?: string | null }>;
      const iRows = (invoices.data || []) as Array<{ status?: string | null }>;

      setExtras({
        noteCount: notes.count || 0,
        approvalApprovedCount: dRows.filter((d) => d.status === "approved").length,
        approvalPendingCount: dRows.filter((d) => d.status === "pending" || d.status === "in_review").length,
        contractCount: cRows.length,
        contractSignedCount: cRows.filter((c) => c.status === "signed" || c.status === "active").length,
        invoiceCount: iRows.length,
        invoicePaidCount: iRows.filter((i) => i.status === "paid").length,
      });
    })().catch((e) => console.warn("[useProjectFlowExtras] failed", e));

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return extras;
}
