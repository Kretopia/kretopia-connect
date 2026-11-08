import type { GigOpportunity } from "@/components/opportunity/GigCard";

const USAGE_LABELS: Record<string, string> = {
  organic_social: "Organic Social",
  paid_ads: "Paid Ads",
  full_buyout: "Full Buyout",
  broadcast: "Broadcast",
  ooh: "OOH",
  web_only: "Web Only",
};

/** What the work may be used for, where and for how long, as one line ("Broadcast · EU · 2 years"); null when the opportunity says nothing. */
export const formatUsageRights = (opp: Pick<GigOpportunity, "usage_type" | "usage_territory" | "usage_duration">): string | null => {
  if (!opp.usage_type && !opp.usage_territory && !opp.usage_duration) return null;
  const parts: string[] = [];
  if (opp.usage_type) parts.push(USAGE_LABELS[opp.usage_type] || opp.usage_type);
  if (opp.usage_territory) parts.push(opp.usage_territory);
  if (opp.usage_duration) parts.push(opp.usage_duration);
  return parts.join(" · ");
};
