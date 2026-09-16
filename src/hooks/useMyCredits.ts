import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useMyCredits — the ONLY data source for the Credits dashboard.
 *
 * Both calls are auth-scoped RPCs (`search_my_credits`, `my_credits_overview`)
 * that derive the user from `auth.uid()` server-side. The browser never sends
 * a user_id and there is no fetch-all-then-filter anywhere in this hook, so a
 * signed-in person can only ever read their own record.
 */

export interface MyCredit {
  id: string;
  project_name: string;
  role: string;
  year: number | null;
  verification_status: string | null;
  credit_category: string | null;
  project_type: string | null;
  platform: string | null;
  client_brand: string | null;
  location: string | null;
  thumbnail_url: string | null;
  primary_media_url: string | null;
  url: string | null;
  endorsement_count: number;
  created_at: string;
}

export interface MyCreditsOverview {
  total_credits: number;
  verified_credits: number;
  pending_credits: number;
  missing_evidence: number;
  endorsements_received: number;
  last_credit_at: string | null;
}

export type CreditsErrorKind = "auth" | "network" | null;

export function useMyCredits(query: string) {
  const [credits, setCredits] = useState<MyCredit[]>([]);
  const [overview, setOverview] = useState<MyCreditsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<CreditsErrorKind>(null);

  const loadOverview = useCallback(async () => {
    const { data, error: err } = await (supabase.rpc as any)("my_credits_overview");
    if (err) {
      setError(err.code === "42501" ? "auth" : "network");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setOverview((row as MyCreditsOverview) ?? null);
  }, []);

  const loadCredits = useCallback(async (q: string) => {
    const { data, error: err } = await (supabase.rpc as any)("search_my_credits", {
      p_query: q.slice(0, 120),
      p_limit: 60,
    });
    if (err) {
      setError(err.code === "42501" ? "auth" : "network");
      setCredits([]);
      return;
    }
    setError(null);
    setCredits((data as MyCredit[]) || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadCredits(query)]).catch(() => setError("network"));
    setLoading(false);
  }, [loadOverview, loadCredits, query]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadOverview(), loadCredits("")]);
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError("network");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search within the personal scope (debounced by the caller)
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setSearching(true);
    loadCredits(query)
      .catch(() => setError("network"))
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { credits, overview, loading, searching, error, refresh };
}
