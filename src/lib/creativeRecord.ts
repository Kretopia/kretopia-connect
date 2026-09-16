import { supabase } from "@/integrations/supabase/client";

// Creative Passport migration — Creative Record read layer.
// credits + discovered_credits already model "everything on record about a
// creator's work" (confirmed + AI-discovered); this aggregates both into one
// typed, read-only view instead of introducing a new table. No writes here —
// confirming a discovery still goes through approve_discovered_credit (RPC),
// unchanged.

export type CreativeRecordStatus = "verified" | "peer" | "auto_discovered" | "unverified" | "potential";

export interface CreativeRecordEntry {
  id: string;
  source: "credit" | "discovery";
  projectName: string;
  role: string | null;
  year: number | null;
  category: string | null;
  status: CreativeRecordStatus;
  thumbnailUrl: string | null;
  url: string | null;
}

function creditStatus(verificationStatus: string | null): CreativeRecordStatus {
  const s = (verificationStatus || "").toLowerCase();
  if (s === "verified" || s === "enterprise") return "verified";
  if (s === "peer") return "peer";
  if (s === "auto_discovered") return "auto_discovered";
  return "unverified";
}

export async function fetchCreativeRecord(userId: string): Promise<CreativeRecordEntry[]> {
  const [{ data: credits, error: creditsError }, { data: discoveries, error: discoveriesError }] = await Promise.all([
    supabase
      .from("credits")
      .select("id, project_name, role, year, credit_category, thumbnail_url, url, verification_status")
      .eq("user_id", userId),
    supabase
      .from("discovered_credits")
      .select("id, project_name, role, year, credit_category, thumbnail_url, url")
      .eq("user_id", userId)
      .eq("status", "pending"),
  ]);

  if (creditsError) throw creditsError;
  if (discoveriesError) throw discoveriesError;

  const fromCredits: CreativeRecordEntry[] = (credits || []).map((c) => ({
    id: c.id,
    source: "credit",
    projectName: c.project_name,
    role: c.role,
    year: c.year,
    category: c.credit_category,
    status: creditStatus(c.verification_status),
    thumbnailUrl: c.thumbnail_url,
    url: c.url,
  }));

  const fromDiscoveries: CreativeRecordEntry[] = (discoveries || []).map((d) => ({
    id: d.id,
    source: "discovery",
    projectName: d.project_name,
    role: d.role,
    year: d.year,
    category: d.credit_category,
    status: "potential",
    thumbnailUrl: d.thumbnail_url,
    url: d.url,
  }));

  return [...fromCredits, ...fromDiscoveries].sort((a, b) => (b.year || 0) - (a.year || 0));
}
