import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProjectMoneySignal {
  hasBudget: boolean;
  hasInvoice: boolean;
  hasTimeEntries: boolean;
  isPaidWorkspace: boolean;
  /** True when the Money section should appear in Studio */
  visible: boolean;
  loading: boolean;
}

const PAID_WORKSPACE_TYPES = new Set([
  "client_work",
  "event_production",
  "photo_shoot",
  "music",
  "general", // fallback when nothing else specified
]);

/**
 * Decides whether the Money section is worth showing on a Studio Room.
 * Visible when ANY of these is true:
 *  - project has a numeric budget / client_price / creative_payout
 *  - an invoice already exists for the project
 *  - any tracked time entries exist for the project
 * Personal/passion projects with no money signal stay clean.
 */
export function useProjectMoneySignal(
  project: {
    id: string;
    workspace_type?: string | null;
    budget?: number | null;
    client_price?: number | null;
    creative_payout?: number | null;
    deal_type?: string | null;
  } | null,
): ProjectMoneySignal {
  const [hasInvoice, setHasInvoice] = useState(false);
  const [hasTimeEntries, setHasTimeEntries] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasBudget = !!(
    project?.budget ||
    project?.client_price ||
    project?.creative_payout
  );
  const isPaidWorkspace =
    !!project?.deal_type && project.deal_type !== "personal";

  useEffect(() => {
    if (!project?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ count: invCount }, { count: teCount }] = await Promise.all([
          supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id),
          supabase
            .from("project_time_entries")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id),
        ]);
        if (cancelled) return;
        setHasInvoice((invCount ?? 0) > 0);
        setHasTimeEntries((teCount ?? 0) > 0);
      } catch (err) {
        console.error("[useProjectMoneySignal]", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  const visible = hasBudget || hasInvoice || hasTimeEntries || isPaidWorkspace;

  return { hasBudget, hasInvoice, hasTimeEntries, isPaidWorkspace, visible, loading };
}
