import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildCatalog, type CatalogItem, type ExternalRow, type KretopiaRow } from "@/lib/scoutCatalog";

export const SCOUT_CATALOG_KEY = ["scout-catalog"] as const;

// The public view only: a curator has reviewed every row against its original source, and nothing private is in it.
const EXTERNAL_COLUMNS =
  "id, title, original_publisher, location, remote_scope, source_published_at, deadline_at, apply_url, excerpt, last_checked_at, source_provider, claimed, budget";
const KRETOPIA_COLUMNS = "id, title, type, description, compensation, location, created_at, image_url";

export interface ScoutCatalog {
  items: CatalogItem[];
  /** One of the two reads failed: what is shown is real but not everything. */
  partial: boolean;
}

/**
 * Every opportunity Scout can show, from every source: the reviewed gigs found outside Kretopia and the open gigs posted on Kretopia.
 * The two reads are independent, so one failing never blanks the other.
 */
export function useScoutCatalog() {
  return useQuery<ScoutCatalog>({
    queryKey: SCOUT_CATALOG_KEY,
    queryFn: async () => {
      const [ext, kre] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the view is not in the generated types yet
        (supabase.from("public_external_listings" as any) as any)
          .select(EXTERNAL_COLUMNS)
          .eq("kind", "gig")
          .order("source_published_at", { ascending: false, nullsFirst: false })
          .limit(1000),
        supabase.from("opportunities").select(KRETOPIA_COLUMNS).in("status", ["active", "open"]).order("created_at", { ascending: false }).limit(200),
      ]);
      if (ext.error && kre.error) throw ext.error;
      return {
        items: buildCatalog(ext.error ? [] : ((ext.data ?? []) as ExternalRow[]), kre.error ? [] : ((kre.data ?? []) as KretopiaRow[])),
        partial: !!(ext.error || kre.error),
      };
    },
    staleTime: 5 * 60_000,
  });
}
